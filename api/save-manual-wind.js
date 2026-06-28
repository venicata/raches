import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const REAL_WIND_HISTORY_KEY = 'max_wind_history';

/**
 * Saves manually entered wind data to maxWindHistory
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { date, windSpeedKnots, timestamp, peakHour } = request.body;

        if (!date || windSpeedKnots === undefined || !timestamp) {
            return response.status(400).json({ error: 'Missing required fields: date, windSpeedKnots, timestamp' });
        }

        // Validate wind speed
        const windSpeed = parseFloat(windSpeedKnots);
        if (isNaN(windSpeed) || windSpeed < 0 || windSpeed > 50) {
            return response.status(400).json({ error: 'Invalid wind speed. Must be between 0 and 50 knots' });
        }

        // Create the wind record in the same format as the station data
        const windRecord = {
            timestamp: timestamp,
            windSpeedKnots: windSpeed,
            windGustKnots: windSpeed * 1.2, // Estimate gusts as 1.2x of sustained wind
            source: 'manual', // Mark as manually entered
            peakHour: peakHour || null // Add peak hour if provided
        };

        // Fetch existing history
        const historyRaw = await redis.get(REAL_WIND_HISTORY_KEY);
        let history = historyRaw ? (typeof historyRaw === 'string' ? JSON.parse(historyRaw) : historyRaw) : [];
        
        if (!Array.isArray(history)) {
            history = [historyRaw];
        }

        // Check if there's already a record for this date
        const dateStr = date; // date should be in YYYY-MM-DD format
        const existingIndex = history.findIndex(record => record.timestamp.startsWith(dateStr));

        if (existingIndex !== -1) {
            // Update existing record
            history[existingIndex] = windRecord;
        } else {
            // Add new record
            history.push(windRecord);
        }

        // Sort by timestamp
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Save back to Redis
        await redis.set(REAL_WIND_HISTORY_KEY, JSON.stringify(history));

        return response.status(200).json({ 
            success: true, 
            message: 'Manual wind data saved successfully',
            record: windRecord
        });

    } catch (error) {
        console.error('Error saving manual wind data:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}
