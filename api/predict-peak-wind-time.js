import { Redis } from '@upstash/redis';
import { create, all } from 'mathjs';

const redis = Redis.fromEnv();
const math = create(all, {});
math.config({
    matrix: 'Matrix'
});

const FORECAST_HISTORY_KEY = 'rachesForecastHistory';
const REAL_WIND_HISTORY_KEY = 'max_wind_history';
const PEAK_WIND_MODEL_KEY = 'peak_wind_model_v2_monthly'; // New key for the month-aware model

/**
 * Core logic for predicting the peak wind time.
 */
export async function predictPeakWindTime() {
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
        return { success: false, message: 'Insufficient data for model generation.' };
    }

    // 2. Prepare training data
    const forecastMap = new Map(forecastHistory.map(f => [f.date, f]));
    const trainingData = [];

    for (const windRecord of realWindHistory) {
        const date = windRecord.timestamp.split('T')[0];
        const forecast = forecastMap.get(date);

        if (forecast) {
            const month = new Date(date).getUTCMonth() + 1; // Month (1-12)
            const hour = new Date(windRecord.timestamp).getUTCHours(); // Label

            const features = [
                month,
                forecast.cloud_cover_score,
                forecast.temp_diff_score,
                forecast.wind_speed_score,
                forecast.wind_direction_score,
                forecast.suck_effect_score_value,
                forecast.pressure_drop_score,
                forecast.humidity_score,
                forecast.precipitation_probability_score
            ].map(v => (typeof v === 'number' ? v : 0));

            trainingData.push({ features, target: hour });
        }
    }

    const NUM_FEATURES = 9;
    if (trainingData.length < NUM_FEATURES + 1) {
        return { success: false, message: `Not enough matching data points. Need at least ${NUM_FEATURES + 1}, but have ${trainingData.length}.` };
    }

    // 3. Build matrices and calculate coefficients
    const X = math.matrix(trainingData.map(d => [1, ...d.features]), 'dense');
    const y = math.matrix(trainingData.map(d => [d.target]), 'dense');
    const Xt = math.transpose(X);
    let XtX = math.multiply(Xt, X);

    const lambda = 0.1; // Regularization term
    const I = math.identity(XtX.size()[0]);
    XtX = math.add(XtX, math.multiply(I, lambda));

    let XtX_inv;
    try {
        XtX_inv = math.inv(XtX);
    } catch (error) {
        console.error('Error inverting matrix:', error);
        throw new Error('Matrix inversion failed, possible multicollinearity.');
    }

    const coefficients = math.flatten(math.multiply(math.multiply(XtX_inv, Xt), y)).toArray();

    // 4. Save the trained model
    const model = {
        version: '2.0-monthly-linear-regression',
        lastUpdated: new Date().toISOString(),
        coefficients: {
            intercept: coefficients[0],
            month: coefficients[1],
            cloud_cover: coefficients[2],
            temp_diff: coefficients[3],
            wind_speed: coefficients[4],
            wind_direction: coefficients[5],
            suck_effect: coefficients[6],
            pressure_drop: coefficients[7],
            humidity: coefficients[8],
            precipitation: coefficients[9],
        },
        recordsAnalyzed: trainingData.length
    };

    await redis.set(PEAK_WIND_MODEL_KEY, JSON.stringify(model));

    return { success: true, message: 'Peak wind time model trained and saved successfully.', model };
}

/**
 * Vercel Serverless Function handler.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const result = await predictPeakWindTime();
        return response.status(200).json(result);
    } catch (error) {
        console.error('Error during peak wind time model calculation:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}
