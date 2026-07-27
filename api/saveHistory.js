// File: api/saveHistory.js
import { Redis } from '@upstash/redis';
import { getSettings } from './settings.js';

const redis = Redis.fromEnv();
const HISTORY_KEY = 'rachesForecastHistory';
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
const MAX_HISTORY_DAYS = 5000; // Align with your desired limit

/**
 * Checks whether real wind data has already been recorded for a given date,
 * meaning the day is "resolved" and its forecast should no longer be revised.
 */
async function hasRealDataForDate(date) {
    const raw = await redis.get(MAX_WIND_HISTORY_KEY);
    const maxWindHistory = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
    if (!Array.isArray(maxWindHistory)) return false;
    return maxWindHistory.some(record => record.timestamp && record.timestamp.split('T')[0] === date);
}

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
            const settings = await getSettings();
            if (settings.lockForecastAfterActual && await hasRealDataForDate(newEntry.date)) {
                // The real outcome for this day is already known, so keep the
                // originally saved forecast untouched for historical accuracy
                // tracking instead of overwriting it with a later, model-revised value.
                return response.status(200).json({
                    message: 'Forecast is locked (real data already recorded for this date); entry left unchanged',
                    locked: true,
                    entry: currentHistoryArray[existingEntryIndex]
                });
            }
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