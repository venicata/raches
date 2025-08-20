import { Redis } from '@upstash/redis';
import { create, all } from 'mathjs';

const redis = Redis.fromEnv();
const math = create(all);
const { inv, multiply, transpose, flatten } = math;

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
        const realWindMap = new Map(realWindHistory.map(r => [r.timestamp.split('T')[0], r.windSpeedKnots]));
        const trainingData = [];

        forecastHistory.forEach(forecast => {
            const realKnots = realWindMap.get(forecast.date);
            if (realKnots !== undefined && realKnots !== null) {
                // These are the 5 features for our model
                const features = [
                    forecast.cloud_cover_score,
                    forecast.temp_diff_score,
                    forecast.wind_direction_score,
                    forecast.suck_effect_score_value
                ].map(v => (typeof v === 'number' ? v : 0)); // Default to 0 if not a number

                trainingData.push({
                    features: features,
                    target: realKnots
                });
            }
        });

        console.log(trainingData);

        const NUM_FEATURES = 4;
        if (trainingData.length < NUM_FEATURES + 1) {
            return response.status(200).json({ message: `Not enough matching data points. Need at least ${NUM_FEATURES + 1}, but have ${trainingData.length}.` });
        }

        // 3. Build matrices for linear regression
        // Add a bias term (column of 1s) to our features
        const X = trainingData.map(d => [1, ...d.features]); // Matrix X
        const y = trainingData.map(d => [d.target]);      // Vector y

        // 4. Calculate coefficients using the Normal Equation: (X^T * X)^-1 * X^T * y
        const Xt = transpose(X);
        const XtX = multiply(Xt, X);
                let XtX_inv;
        try {
            XtX_inv = inv(XtX);
        } catch (error) {
            console.error('Error inverting matrix:', error);
            return response.status(400).json({
                success: false,
                error: 'Matrix inversion failed. The data is likely not suitable for building a model (e.g., it might be collinear).'
            });
        }
        const XtX_inv_Xt = multiply(XtX_inv, Xt);
        const coefficients = flatten(multiply(XtX_inv_Xt, y)); // Flatten to get a simple array

        // 5. Save the trained model to Redis
        const model = {
            version: '4.0-linear-regression',
            lastUpdated: new Date().toISOString(),
            coefficients: {
                intercept: coefficients[0],
                cloud_cover: coefficients[1],
                temp_diff: coefficients[2],
                wind_direction: coefficients[3],
                suck_effect: coefficients[4],
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

