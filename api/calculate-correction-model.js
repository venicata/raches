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
    const dailyMaxWind = {};
    realWindHistory.forEach(r => {
        const date = r.timestamp.split('T')[0];
        const currentMax = dailyMaxWind[date] || -Infinity;
        if (r.windSpeedKnots > currentMax) {
            dailyMaxWind[date] = r.windSpeedKnots;
        }
    });

    const trainingData = [];
    const forecastMap = new Map(forecastHistory.map(f => [f.date, f]));
    let unmatchedRecords = 0;

    for (const date in dailyMaxWind) {
        const forecast = forecastMap.get(date);
        const realKnots = dailyMaxWind[date];

        if (forecast) {
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

            trainingData.push({ features, target: wind_diff });
        } else {
            unmatchedRecords++;
        }
    }

    const NUM_FEATURES = 8;
    if (trainingData.length < NUM_FEATURES + 1) {
        return { success: true, message: `Not enough matching data points. Need at least ${NUM_FEATURES + 1}, but have ${trainingData.length}. Unmatched real wind records: ${unmatchedRecords}.` };
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
        console.error('Error inverting matrix:', error);
        throw new Error('Matrix inversion failed. Data might be collinear.');
    }

    const XtX_inv_Xt = math.multiply(XtX_inv, Xt);
    const coefficients = math.flatten(math.multiply(XtX_inv_Xt, y)).toArray();

    // 5. Save the trained model
    const model = {
        version: '5.0-linear-regression',
        lastUpdated: new Date().toISOString(),
        coefficients: {
            intercept: coefficients[0],
            cloud_cover: coefficients[1],
            temp_diff: coefficients[2],
            wind_speed: coefficients[3],
            wind_direction: coefficients[4],
            suck_effect: coefficients[5],
            pressure_drop: coefficients[6],
            humidity: coefficients[7],
            precipitation: coefficients[8],
        },
        recordsAnalyzed: trainingData.length
    };

    await redis.set(MODEL_KEY, JSON.stringify(model));

    return { success: true, message: 'Linear regression model trained and saved successfully.', model };
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

