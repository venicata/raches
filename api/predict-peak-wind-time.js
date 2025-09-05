import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
const PEAK_WIND_MODEL_KEY = 'peak_wind_model_v3_monthly_avg';

/**
 * Calculates the average peak hour for each month from wind history data.
 * This is a pure function, easy to test and reuse.
 * @param {Array<Object>} maxWindHistory - Array of wind records.
 * @returns {Object} - An object containing monthly averages and the number of records analyzed.
 */
export function calculateMonthlyAverages(maxWindHistory) {
    const monthlyPeakMinutes = {};

    for (const record of maxWindHistory) {
        if (record.timestamp) {
            const date = new Date(record.timestamp);
            const month = date.getUTCMonth() + 1; // 1-12
            const minutesPastMidnight = date.getUTCHours() * 60 + date.getUTCMinutes();

            if (!monthlyPeakMinutes[month]) {
                monthlyPeakMinutes[month] = [];
            }
            monthlyPeakMinutes[month].push(minutesPastMidnight);
        }
    }

    const monthlyAverages = {};
    let totalRecordsAnalyzed = 0;

    for (const month in monthlyPeakMinutes) {
        const minutes = monthlyPeakMinutes[month];
        if (minutes.length > 0) {
            const averageMinutes = minutes.reduce((a, b) => a + b, 0) / minutes.length;
            // Convert average minutes back to a fractional hour for storage
            const averageHour = averageMinutes / 60;
            monthlyAverages[month] = parseFloat(averageHour.toFixed(4)); // Increased precision
            totalRecordsAnalyzed += minutes.length;
        }
    }

    return { monthlyAverages, totalRecordsAnalyzed };
}


export async function trainAndSavePeakTimeModel(maxWindHistoryData = null) {
    // 1. Fetch max wind history from Redis if not provided
    const maxWindHistory = maxWindHistoryData ?? (await redis.get(MAX_WIND_HISTORY_KEY) || []);

    if (maxWindHistory.length === 0) {
        return { success: false, message: 'No max wind history data available to train the model.' };
    }

    // 2. Calculate the average peak hour for each month
    const { monthlyAverages, totalRecordsAnalyzed } = calculateMonthlyAverages(maxWindHistory);

    // 3. Save the new model to Redis
    const model = {
        version: '3.1-monthly-avg-precise',
        lastUpdated: new Date().toISOString(),
        monthly_avg_peak_hour: monthlyAverages,
        recordsAnalyzed: totalRecordsAnalyzed
    };

    if (!maxWindHistoryData) { // Only save to redis if not in a test run
        await redis.set(PEAK_WIND_MODEL_KEY, JSON.stringify(model));
    }

    return { success: true, message: 'Peak wind time model (monthly avg) trained and saved successfully.', model };
}


export default async function handler(request, response) {
    if (request.method !== 'GET' && request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const result = await trainAndSavePeakTimeModel();
        return response.status(200).json(result);
    } catch (error) {
        console.error('Error in peak wind time model training handler:', error);
        return response.status(500).json({ success: false, message: error.message });
    }
}
