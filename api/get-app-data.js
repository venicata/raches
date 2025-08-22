// File: /api/get-app-data.js
// Vercel Serverless Function to retrieve combined application data from Redis.

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const HISTORY_KEY = 'rachesForecastHistory';
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
import md5 from 'md5';

export default async function handler(request, response) {

    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const pipeline = redis.pipeline();
        pipeline.get(HISTORY_KEY);
        pipeline.get(MAX_WIND_HISTORY_KEY);
        
        const [historyResult, maxWindHistoryResult] = await pipeline.exec();

        // Process forecast history
        let parsedHistory = [];
        if (historyResult) {
            try {
                parsedHistory = typeof historyResult === 'string' ? JSON.parse(historyResult) : historyResult;
            } catch (e) {
                console.error('Error parsing history JSON string from Redis:', e);
                // Continue without history data
            }
        }

        // Process max wind history
        const maxWindHistory = maxWindHistoryResult || [];

        response.status(200).json({
            forecastHistory: Array.isArray(parsedHistory) ? parsedHistory : [],
            maxWindHistory: maxWindHistory
        });

    } catch (error) {
        console.error('Error fetching combined history from Redis:', error);
        response.status(500).json({ error: 'Failed to fetch combined application data' });
    }
}
