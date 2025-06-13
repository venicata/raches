// File: api/getHistory.js
import { Redis } from '@upstash/redis';

// Initialize Redis client using environment variables
// Vercel automatically makes environment variables available.
// Ensure your Upstash Redis URL and Token are set in Vercel project settings.
// Common names are UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
// or the KV_ equivalents you provided. Redis.fromEnv() will try to find them.
const redis = Redis.fromEnv();

const HISTORY_KEY = 'rachesForecastHistory'; // The key where history is stored in Redis

export default async function handler(request, response) {
    if (request.method !== 'GET') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const history = await redis.get(HISTORY_KEY);
        // Data in Redis is often stored as a string, so parse if it's JSON
        // If 'history' is null (key doesn't exist), default to an empty array.
        let parsedHistory = [];
        if (history) {
            if (typeof history === 'string') {
                try {
                    parsedHistory = JSON.parse(history);
                } catch (e) {
                    console.error('Error parsing history JSON string from Redis:', e);
                    // Decide if to return error or empty array
                    return response.status(500).json({ error: 'Failed to parse historical data' });
                }
            } else {
                // If it's not a string, assume it's already in the correct array format (e.g. if SDK auto-parses)
                parsedHistory = history;
            }
        }
        response.status(200).json(Array.isArray(parsedHistory) ? parsedHistory : []);
    } catch (error) {
        console.error('Error fetching history from Redis:', error);
        response.status(500).json({ error: 'Failed to fetch history' });
    }
}