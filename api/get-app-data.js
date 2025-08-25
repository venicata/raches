// File: /api/get-app-data.js
// Vercel Serverless Function to retrieve combined application data from Redis.

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const HISTORY_KEY = 'rachesForecastHistory';
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
import md5 from 'md5';

const PEAK_WIND_MODEL_KEY = 'peak_wind_model_v2_monthly';

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Fetch all required data in parallel
        const [historyResult, maxWindHistoryResult, modelResult] = await Promise.all([
            redis.get(HISTORY_KEY),
            redis.get(MAX_WIND_HISTORY_KEY),
            redis.get(PEAK_WIND_MODEL_KEY)
        ]);

        // Process forecast history
        let forecastHistory = [];
        if (historyResult) {
            try {
                forecastHistory = typeof historyResult === 'string' ? JSON.parse(historyResult) : historyResult;
                if (!Array.isArray(forecastHistory)) forecastHistory = [forecastHistory];
            } catch (e) {
                console.error('Error parsing forecast history from Redis:', e);
            }
        }

        // Process max wind history
        const maxWindHistory = maxWindHistoryResult || [];

        // Process peak wind model and make prediction
        let predictedPeakTime = null;
        if (modelResult && forecastHistory.length > 0) {
            const model = typeof modelResult === 'string' ? JSON.parse(modelResult) : modelResult;
            const latestForecast = forecastHistory[0]; // Assume the first is the latest
            const month = new Date(latestForecast.date).getUTCMonth() + 1;

            const features = [
                month,
                latestForecast.cloud_cover_score,
                latestForecast.temp_diff_score,
                latestForecast.wind_speed_score,
                latestForecast.wind_direction_score,
                latestForecast.suck_effect_score_value,
                latestForecast.pressure_drop_score,
                latestForecast.humidity_score,
                latestForecast.precipitation_probability_score
            ].map(v => (typeof v === 'number' ? v : 0));

            const c = model.coefficients;
            const featureCoefficients = [
                c.month, c.cloud_cover, c.temp_diff, c.wind_speed, c.wind_direction,
                c.suck_effect, c.pressure_drop, c.humidity, c.precipitation
            ];

            let predictedHour = c.intercept;
            for (let i = 0; i < features.length; i++) {
                predictedHour += features[i] * (featureCoefficients[i] || 0);
            }

            // Clamp the hour between 0 and 23 and format it
            const hour = Math.max(0, Math.min(23, Math.round(predictedHour)));
            const minutes = Math.round((predictedHour - Math.floor(predictedHour)) * 60);
            const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
            predictedPeakTime = `${hour}:${formattedMinutes}`;
        }

        response.status(200).json({
            forecastHistory: forecastHistory,
            maxWindHistory: maxWindHistory,
            predictedPeakTime: predictedPeakTime
        });

    } catch (error) {
        console.error('Error in get-app-data handler:', error);
        response.status(500).json({ error: 'Failed to fetch combined application data' });
    }
}
