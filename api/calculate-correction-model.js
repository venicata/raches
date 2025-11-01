import { Redis } from '@upstash/redis';
import { create, all } from 'mathjs';
import md5 from 'md5';

const redis = Redis.fromEnv();
const math = create(all, {});
math.config({
    matrix: 'Matrix' // Configure math.js to use Matrix type
});

const FORECAST_HISTORY_KEY = 'rachesForecastHistory';
const REAL_WIND_HISTORY_KEY = 'max_wind_history';
const MODEL_KEY = 'prediction_model_v5'; // New model key to avoid conflicts

/**
 * Core logic for calculating the correction model.
 */
export async function calculateCorrectionModel() {
    // 1. Fetch and parse data from Redis
    const [forecastHistoryRaw, realWindHistoryRaw] = await Promise.all([
        redis.get(FORECAST_HISTORY_KEY),
        redis.get(REAL_WIND_HISTORY_KEY)
    ]);

    let forecastHistory = forecastHistoryRaw ? (typeof forecastHistoryRaw === 'string' ? JSON.parse(forecastHistoryRaw) : forecastHistoryRaw) : [];
    let realWindHistory = realWindHistoryRaw ? (typeof realWindHistoryRaw === 'string' ? JSON.parse(realWindHistoryRaw) : realWindHistoryRaw) : [];

    if (!Array.isArray(forecastHistory)) forecastHistory = [forecastHistory];
    if (!Array.isArray(realWindHistory)) realWindHistory = [realWindHistory];

    if (forecastHistory.length === 0 || realWindHistory.length === 0) {
        return { success: true, message: 'Insufficient data for model generation.' };
    }

    // 2. Combine and prepare data
    const forecastMap = new Map(forecastHistory.map(f => [f.date, f]));
    const realWindMap = new Map(realWindHistory.map(r => [r.timestamp.split('T')[0], r]));

    const monthlyTrainingData = {};
    let unmatchedRecords = 0;

    for (const [date, realWindRecord] of realWindMap.entries()) {
        const forecast = forecastMap.get(date);

        if (forecast) {
            const realKnots = realWindRecord.windSpeedKnots;

            const features = [
                forecast.cloud_cover_score,
                forecast.temp_diff_score,
                forecast.wind_speed_score,
                forecast.wind_direction_score,
                forecast.suck_effect_score_value,
                forecast.pressure_drop_score,
                forecast.humidity_score,
                forecast.precipitation_probability_score
            ].map(v => (typeof v === 'number' ? v : 0));

            const predictedKnots = forecast.rawAvgPredictedKnots || forecast.avgPredictedKnots;
            const wind_diff = realKnots - predictedKnots;

            const month = new Date(realWindRecord.timestamp).getMonth() + 1; // 1-12
            if (!monthlyTrainingData[month]) {
                monthlyTrainingData[month] = [];
            }
            monthlyTrainingData[month].push({ features, target: wind_diff });

        } else {
            unmatchedRecords++;
        }
    }

    const NUM_FEATURES = 8;
    const monthlyModels = {};
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);

    // Find which months have enough data to be a source for a model
    const availableDataMonths = allMonths.filter(m => monthlyTrainingData[m] && monthlyTrainingData[m].length >= NUM_FEATURES + 1);

    // If no month has enough data, we can't generate any models
    if (availableDataMonths.length === 0) {
        return { success: true, message: 'Insufficient data for any month to generate models.' };
    }

    for (const month of allMonths) {
        let trainingData;
        let sourceMonth = month;
        let isFallback = false;

        if (monthlyTrainingData[month] && monthlyTrainingData[month].length >= NUM_FEATURES + 1) {
            // Use current month's data as it's sufficient
            trainingData = monthlyTrainingData[month];
        } else {
            // Not enough data, find the most recent month with sufficient data as a fallback
            isFallback = true;
            let fallbackSearchMonth = month === 1 ? 12 : month - 1;
            for (let i = 0; i < 12; i++) { // Loop max 12 times to check all other months
                if (availableDataMonths.includes(fallbackSearchMonth)) {
                    sourceMonth = fallbackSearchMonth;
                    trainingData = monthlyTrainingData[sourceMonth];
                    console.log(`Month ${month} has insufficient data. Using data from month ${sourceMonth}.`);
                    break;
                }
                fallbackSearchMonth = fallbackSearchMonth === 1 ? 12 : fallbackSearchMonth - 1;
            }
        }

        if (!trainingData) {
            console.log(`Skipping month ${month}, no sufficient data or fallback found.`);
            continue;
        }

        // 3. Build matrices and calculate coefficients
        const X = math.matrix(trainingData.map(d => [1, ...d.features]), 'dense');
        const y = math.matrix(trainingData.map(d => [d.target]), 'dense');
        const Xt = math.transpose(X);
        let XtX = math.multiply(Xt, X);

        const lambda = 0.1;
        const I = math.identity(XtX.size()[0]);
        XtX = math.add(XtX, math.multiply(I, lambda));

        let XtX_inv;
        try {
            XtX_inv = math.inv(XtX);
        } catch (error) {
            console.error(`Error inverting matrix for month ${month}:`, error);
            // Skip this month if matrix inversion fails
            continue;
        }

        const XtX_inv_Xt = math.multiply(XtX_inv, Xt);
        const coefficients = math.flatten(math.multiply(XtX_inv_Xt, y)).toArray();

        // 5. Save the trained model for the month
        const model = {
            version: isFallback ? '5.2-linear-regression-monthly-fallback' : '5.2-linear-regression-monthly',
            sourceMonth: sourceMonth,
            lastUpdated: new Date().toISOString(),
            coefficients: {
                intercept: Math.round(coefficients[0] * 100) / 100,
                cloud_cover: Math.round(coefficients[1] * 100) / 100,
                temp_diff: Math.round(coefficients[2] * 100) / 100,
                wind_speed: Math.round(coefficients[3] * 100) / 100,
                wind_direction: Math.round(coefficients[4] * 100) / 100,
                suck_effect: Math.round(coefficients[5] * 100) / 100,
                pressure_drop: Math.round(coefficients[6] * 100) / 100,
                humidity: Math.round(coefficients[7] * 100) / 100,
                precipitation: Math.round(coefficients[8] * 100) / 100,
            },
            recordsAnalyzed: trainingData.length
        };
        monthlyModels[month] = model;
    }

    if (Object.keys(monthlyModels).length === 0) {
        return { success: true, message: 'No monthly models were generated due to insufficient data.' };
    }


    await redis.set(MODEL_KEY, JSON.stringify(monthlyModels));

    return { success: true, message: 'Monthly linear regression models trained and saved successfully.', models: monthlyModels };
}

/**
 * Vercel Serverless Function handler.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const result = await calculateCorrectionModel();
        return response.status(200).json(result);
    } catch (error) {
        console.error('Error during model calculation:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}

