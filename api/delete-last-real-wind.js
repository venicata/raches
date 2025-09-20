import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const MAX_WIND_HISTORY_KEY = 'max_wind_history';

/**
 * Vercel Serverless Function to delete the last (most recent) entry from the real wind history.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    const allowedIp = '84.238.186.66';
    const clientIp = request.headers['x-forwarded-for'] || request.socket.remoteAddress;

    if (clientIp !== allowedIp) {
        console.warn(`Forbidden access attempt from IP: ${clientIp}`);
        return response.status(403).json({ error: 'Forbidden: Access is restricted.' });
    }

    try {
        // 1. Fetch the current history
        const historyRaw = await redis.get(MAX_WIND_HISTORY_KEY);
        let historyArray = historyRaw ? (typeof historyRaw === 'string' ? JSON.parse(historyRaw) : historyRaw) : [];

        if (!Array.isArray(historyArray)) {
            historyArray = [historyArray];
        }

        if (historyArray.length === 0) {
            return response.status(200).json({ success: true, message: 'No records to delete.' });
        }

        // 2. Remove the first element (most recent, as it's sorted descendingly)
        const removedEntry = historyArray.shift();

        // 3. Save the updated array back to Redis
        await redis.set(MAX_WIND_HISTORY_KEY, JSON.stringify(historyArray));

        console.log('Successfully deleted the last real wind entry:', removedEntry);

        return response.status(200).json({
            success: true,
            message: `Successfully deleted the last entry for date: ${removedEntry.timestamp.split('T')[0]}`,
            deletedEntry: removedEntry
        });

    } catch (error) {
        console.error('Error deleting last real wind entry:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}
