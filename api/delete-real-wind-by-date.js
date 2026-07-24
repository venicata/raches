import { Redis } from '@upstash/redis';
import { isAdminAuthorized } from './_auth.js';

const redis = Redis.fromEnv();
const REAL_WIND_HISTORY_KEY = 'max_wind_history';
const EXCLUDED_DATES_KEY = 'excluded_wind_dates';

/**
 * Deletes the real (station or manual) wind record for a specific date, so a bugged
 * station reading can be cleared instead of skewing the correction model. The date is
 * also added to an exclusion list so process-max-wind.js won't re-add it from the
 * station feed on a future cron run (the station is sometimes unreliable for a whole day).
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

        await redis.set(REAL_WIND_HISTORY_KEY, JSON.stringify(history));

        const excludedRaw = await redis.get(EXCLUDED_DATES_KEY);
        let excludedDates = excludedRaw ? (typeof excludedRaw === 'string' ? JSON.parse(excludedRaw) : excludedRaw) : [];
        if (!Array.isArray(excludedDates)) {
            excludedDates = [];
        }
        if (!excludedDates.includes(date)) {
            excludedDates.push(date);
            await redis.set(EXCLUDED_DATES_KEY, JSON.stringify(excludedDates));
        }

        if (history.length === before) {
            return response.status(200).json({ success: true, message: `Няма запис за ${date}, но датата е маркирана да не се добавя автоматично.` });
        }

        return response.status(200).json({ success: true, message: `Реалните данни за ${date} бяха изтрити и датата няма да се добавя автоматично при следващо обновяване.` });
    } catch (error) {
        console.error('Error deleting real wind data for date:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}
