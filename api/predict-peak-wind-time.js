import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
const PEAK_WIND_MODEL_KEY = 'peak_wind_model_v3_monthly_avg'; // New key for the new model

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

export async function trainAndSavePeakTimeModel() {
    // 1. Fetch max wind history from Redis
    const maxWindHistoryResult = await redis.get(MAX_WIND_HISTORY_KEY);
    const maxWindHistory = maxWindHistoryResult
        ? (typeof maxWindHistoryResult === 'string' ? JSON.parse(maxWindHistoryResult) : maxWindHistoryResult)
        : [];

    if (maxWindHistory.length === 0) {
        return { success: false, message: 'No max wind history data available to train the model.' };
    }

    // 2. Group peak hours by month
    const monthlyPeakHours = {};
    for (const record of maxWindHistory) {
        if (record.timestamp) {
            const date = new Date(record.timestamp);
            const month = date.getUTCMonth() + 1; // 1-12
            const hour = date.getUTCHours();

            if (!monthlyPeakHours[month]) {
                monthlyPeakHours[month] = [];
            }
            monthlyPeakHours[month].push(hour);
        }
    }

    // 3. Calculate the average peak hour for each month
    const monthlyAverages = {};
    let totalRecordsAnalyzed = 0;
    for (const month in monthlyPeakHours) {
        const hours = monthlyPeakHours[month];
        const averageHour = hours.reduce((a, b) => a + b, 0) / hours.length;
        monthlyAverages[month] = parseFloat(averageHour.toFixed(2)); // Store as number e.g., 14.5
        totalRecordsAnalyzed += hours.length;
    }


    // 4. Save the new model to Redis
    const model = {
        version: '3.0-monthly-average',
        lastUpdated: new Date().toISOString(),
        // Storing averages by month index (1-12)
        monthly_avg_peak_hour: monthlyAverages,
        recordsAnalyzed: totalRecordsAnalyzed
    };

    await redis.set(PEAK_WIND_MODEL_KEY, JSON.stringify(model));

    return { success: true, message: 'Peak wind time model (monthly avg) trained and saved successfully.', model };
}

// This function is being replaced by trainAndSavePeakTimeModel
export const predictPeakWindTime = trainAndSavePeakTimeModel;
