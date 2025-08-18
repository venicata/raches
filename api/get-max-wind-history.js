// File: /api/get-max-wind-history.js
// Vercel Serverless Function to retrieve the historical max wind data from Redis.

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const MAX_WIND_HISTORY_KEY = 'max_wind_history';

export default async function handler(request, response) {
    try {
        const history = await redis.get(MAX_WIND_HISTORY_KEY) || [];

        if (!history.length) {
            return response.status(200).json([]); // Връщаме празен масив, ако няма история
        }

        return response.status(200).json(history);

    } catch (error) {
        console.error('Грешка при извличане на историята от Redis:', error);
        return response.status(500).json({ error: 'Failed to retrieve history' });
    }
}
