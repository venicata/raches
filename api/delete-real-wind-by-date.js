import { Redis } from '@upstash/redis';
import { isAdminAuthorized } from './_auth.js';

const redis = Redis.fromEnv();
const REAL_WIND_HISTORY_KEY = 'max_wind_history';

/**
 * Deletes the real (station or manual) wind record for a specific date, so a bugged
 * station reading can be cleared instead of skewing the correction model.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    if (!isAdminAuthorized(request)) {
        return response.status(401).json({ error: 'Unauthorized' });
    }

    const { date } = request.body || {};
    if (!date) {
        return response.status(400).json({ error: 'Missing required field: date' });
    }

    try {
        const historyRaw = await redis.get(REAL_WIND_HISTORY_KEY);
        let history = historyRaw ? (typeof historyRaw === 'string' ? JSON.parse(historyRaw) : historyRaw) : [];
        if (!Array.isArray(history)) {
            history = [history];
        }

        const before = history.length;
        history = history.filter(record => !record.timestamp || !record.timestamp.startsWith(date));

        if (history.length === before) {
            return response.status(200).json({ success: true, message: `Няма запис за ${date}.` });
        }

        await redis.set(REAL_WIND_HISTORY_KEY, JSON.stringify(history));

        return response.status(200).json({ success: true, message: `Реалните данни за ${date} бяха изтрити.` });
    } catch (error) {
        console.error('Error deleting real wind data for date:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}
