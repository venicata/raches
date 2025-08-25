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

        // Process peak wind model
        const peakWindModel = modelResult ? (typeof modelResult === 'string' ? JSON.parse(modelResult) : modelResult) : null;

        response.status(200).json({
            forecastHistory: forecastHistory,
            maxWindHistory: maxWindHistory,
            peakWindModel: peakWindModel
        });

    } catch (error) {
        console.error('Error in get-app-data handler:', error);
        response.status(500).json({ error: 'Failed to fetch combined application data' });
    }
}
