// File: api/saveHistory.js
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const HISTORY_KEY = 'rachesForecastHistory';
const MAX_HISTORY_DAYS = 450; // Align with your desired limit

export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const newEntry = request.body; // Vercel automatically parses JSON body

        if (!newEntry || !newEntry.date) {
            return response.status(400).json({ error: 'Invalid entry data' });
        }

        let history = await redis.get(HISTORY_KEY);
        let currentHistoryArray = [];
        if (history) {
            if (typeof history === 'string') {
                try {
                    currentHistoryArray = JSON.parse(history);
                } catch (e) {
                    console.error('Error parsing existing history JSON string from Redis in saveHistory:', e);
                    // Decide how to handle, perhaps overwrite with new entry only or return error
                    return response.status(500).json({ error: 'Failed to parse existing historical data before saving' });
                }
            } else {
                // If it's not a string, assume it's already in the correct array format
                currentHistoryArray = history;
            }
        }
        // Ensure currentHistoryArray is an array before proceeding
        if (!Array.isArray(currentHistoryArray)) currentHistoryArray = [];

        const existingEntryIndex = currentHistoryArray.findIndex(item => item.date === newEntry.date);

        if (existingEntryIndex !== -1) {
            currentHistoryArray[existingEntryIndex] = newEntry; // Update existing entry
        } else {
            currentHistoryArray.push(newEntry); // Add new entry
        }

        // Sort by date (ascending)
        currentHistoryArray.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Keep only the last MAX_HISTORY_DAYS entries
        if (currentHistoryArray.length > MAX_HISTORY_DAYS) {
            //currentHistoryArray = currentHistoryArray.slice(-MAX_HISTORY_DAYS);
        }

        // Store the updated history back in Redis (as a JSON string)
        await redis.set(HISTORY_KEY, JSON.stringify(currentHistoryArray)); // Ensure we store as a JSON string

        response.status(200).json({ message: 'History saved successfully', entry: newEntry });
    } catch (error) {
        console.error('Error saving history to Redis:', error);
        response.status(500).json({ error: 'Failed to save history' });
    }
}