// File: /api/get-app-data.js
// Vercel Serverless Function to retrieve combined application data from Redis.

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const HISTORY_KEY = 'rachesForecastHistory';
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
import md5 from 'md5';

const PEAK_WIND_MODEL_KEY = 'peak_wind_model_v3_monthly_avg';

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

        // Process peak wind model and make prediction using the new monthly average model
        let predictedPeakTime = null;
        if (modelResult && forecastHistory.length > 0) {
            const model = typeof modelResult === 'string' ? JSON.parse(modelResult) : modelResult;
            const latestForecast = forecastHistory[0]; // Assume the first is the latest
            const month = new Date(latestForecast.date).getUTCMonth(); // 0-11, to match model keys

            if (model.monthly_avg_peak_hour && model.monthly_avg_peak_hour[month] !== undefined) {
                const averageHour = model.monthly_avg_peak_hour[month]; // e.g., 14.5
                const hour = Math.floor(averageHour);
                const minutes = Math.round((averageHour - hour) * 60);
                const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
                predictedPeakTime = `${hour}:${formattedMinutes}`;
            }
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
