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
const MODEL_KEY = 'prediction_model_v4'; // New model key to avoid conflicts

/**
 * Trains a multiple linear regression model and saves it to Redis.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }


    try {
                // 1. Fetch and parse data from Redis
        const [forecastHistoryRaw, realWindHistoryRaw] = await Promise.all([
            redis.get(FORECAST_HISTORY_KEY),
            redis.get(REAL_WIND_HISTORY_KEY)
        ]);

        let forecastHistory = forecastHistoryRaw ? (typeof forecastHistoryRaw === 'string' ? JSON.parse(forecastHistoryRaw) : forecastHistoryRaw) : [];
        let realWindHistory = realWindHistoryRaw ? (typeof realWindHistoryRaw === 'string' ? JSON.parse(realWindHistoryRaw) : realWindHistoryRaw) : [];

        // Ensure data is always an array
        if (!Array.isArray(forecastHistory)) forecastHistory = [forecastHistory];
        if (!Array.isArray(realWindHistory)) realWindHistory = [realWindHistory];

        if (!Array.isArray(forecastHistory) || !Array.isArray(realWindHistory) || forecastHistory.length === 0 || realWindHistory.length === 0) {
            return response.status(200).json({ message: 'Insufficient data for model generation.' });
        }

        // 2. Combine and prepare data
        // Ensure deterministic results by selecting the max wind speed for each day
        const dailyMaxWind = {}; // Use a plain object for deterministic behavior
        realWindHistory.forEach(r => {
            const date = r.timestamp.split('T')[0];
            const currentMax = dailyMaxWind[date] || -Infinity;
            if (r.windSpeedKnots > currentMax) {
                dailyMaxWind[date] = r.windSpeedKnots;
            }
        });

        const realWindMap = dailyMaxWind;
        const trainingData = [];

        forecastHistory.forEach(forecast => {
            const realKnots = realWindMap[forecast.date];
            if (realKnots !== undefined && realKnots !== null) {
                // These are the 5 features for our model
                const features = [
                    forecast.cloud_cover_score,
                    forecast.temp_diff_score,
                    forecast.wind_speed_score, // Възстановен параметър
                    forecast.wind_direction_score,
                    forecast.suck_effect_score_value
                ].map(v => (typeof v === 'number' ? v : 0));

                const predictedKnots = forecast.rawAvgPredictedKnots || forecast.avgPredictedKnots;
                const wind_diff = realKnots - predictedKnots;

                trainingData.push({
                    features: features,
                    target: wind_diff // Целта отново е разликата
                });
            }
        });

        // Sort trainingData with a stable sort to ensure the matrix is built deterministically

        const NUM_FEATURES = 5;
        if (trainingData.length < NUM_FEATURES + 1) {
            return response.status(200).json({ message: `Not enough matching data points. Need at least ${NUM_FEATURES + 1}, but have ${trainingData.length}.` });
        }

        // 3. Build matrices for linear regression
        // Add a bias term (column of 1s) to our features
        const X = math.matrix(trainingData.map(d => [1, ...d.features]), 'dense'); // Matrix X
        const y = math.matrix(trainingData.map(d => [d.target]), 'dense');      // Vector y (wind_diff)

        // 4. Calculate coefficients using the Normal Equation: (X^T * X)^-1 * X^T * y
        const Xt = math.transpose(X);
        let XtX = math.multiply(Xt, X);

        // Ridge Regression: Add a small value (lambda * I) to the diagonal to prevent multicollinearity
        const lambda = 0.1; // Regularization parameter
        const I = math.identity(XtX.size()[0]);
        XtX = math.add(XtX, math.multiply(I, lambda));

        let XtX_inv;
        try {
            XtX_inv = math.inv(XtX);
        } catch (error) {
            console.error('Error inverting matrix:', error);
            return response.status(400).json({
                success: false,
                error: 'Matrix inversion failed. The data is likely not suitable for building a model (e.g., it might be collinear).'
            });
        }
        const XtX_inv_Xt = math.multiply(XtX_inv, Xt);
        const coefficients = math.flatten(math.multiply(XtX_inv_Xt, y)).toArray(); // Flatten to get a simple array

        // 5. Save the trained model to Redis
        const model = {
            version: '4.0-linear-regression',
            lastUpdated: new Date().toISOString(),
            coefficients: {
                intercept: coefficients[0],
                cloud_cover: coefficients[1],
                temp_diff: coefficients[2],
                wind_speed: coefficients[3],
                wind_direction: coefficients[4],
                suck_effect: coefficients[5],
            },
            recordsAnalyzed: trainingData.length
        };

        await redis.set(MODEL_KEY, JSON.stringify(model));

        response.status(200).json({
            success: true,
            message: 'Linear regression model trained and saved successfully.',
            model
        });

    } catch (error) {
        console.error('Error during model calculation:', error);
        response.status(500).json({ success: false, error: error.message });
    }
}

