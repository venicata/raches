import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// File: /Users/venelinvenelinov/Projects/raches/api/process-max-wind.js
// Vercel Serverless Function to be triggered by a cron job.
// It fetches weather observations, finds the one with the highest wind speed,
// and saves it to the database.

import { Redis } from '@upstash/redis';
const redis = Redis.fromEnv();

const API_URL = 'https://kiting.live/api/observations/history-5m';
const MAX_WIND_HISTORY_KEY = 'max_wind_history';
// ВАЖНО: Стойностите за API_KEY и CLIENT_USERNAME се взимат от Environment Variables в Vercel.
const API_KEY = process.env.KITING_LIVE_API_KEY;
const CLIENT_USERNAME = process.env.KITING_LIVE_CLIENT_USERNAME;

/**
 * Изтегля историческите данни от API-то на kiting.live.
 */
async function fetchHistoricalData() {
    console.log('Изтегляне на исторически данни...');

    const response = await fetch(API_URL, {
        method: 'GET',
        headers: {
            'api-key': API_KEY,
            'X-Client-Username': CLIENT_USERNAME,
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`API заявката неуспешна със статус ${response.status}: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Намира записа с максимална скорост на вятъра за всеки ден.
 * @param {Array<Object>} observations - Масив с обекти от API-то.
 * @returns {Array<Object>} Масив с обекти с най-висока стойност на windSpeedKnots за всеки ден.
 */
function findMaxWindForEachDay(observations) {
    if (!observations || observations.length === 0) {
        return [];
    }

    // 1. Групираме всички записи по дата (напр. '2025-08-16')
    const dailyObservations = observations.reduce((acc, obs) => {
        const date = obs.timestamp.split('T')[0];
        if (!acc[date]) {
            acc[date] = [];
        }
        acc[date].push(obs);
        return acc;
    }, {});

    // 2. За всеки ден намираме макс. запис и изчисляваме средния вятър около пика
    const dailyMaxRecords = Object.values(dailyObservations).map(dayObs => {
        // Намираме записа с максимален вятър за деня
        const maxRecord = dayObs.reduce((max, current) =>
            (current.windSpeedKnots > max.windSpeedKnots) ? current : max,
            dayObs[0]
        );

        // Изчисляваме средната скорост на вятъра в прозорец -15 мин преди пика и +60 мин след него
        const peakTime = new Date(maxRecord.timestamp).getTime();
        const fifteenMinutes = 15 * 60 * 1000;
        const sixtyMinutes = 60 * 60 * 1000;
        const startTime = peakTime - fifteenMinutes;
        const endTime = peakTime + sixtyMinutes;

        const relevantObservations = dayObs.filter(obs => {
            const obsTime = new Date(obs.timestamp).getTime();
            return obsTime >= startTime && obsTime <= endTime;
        });

        let avgWindSpeedAroundPeak = maxRecord.windSpeedKnots; // По подразбиране е пиковата стойност
        if (relevantObservations.length > 0) {
            const sum = relevantObservations.reduce((acc, obs) => acc + obs.windSpeedKnots, 0);
            avgWindSpeedAroundPeak = sum / relevantObservations.length;
        }

        // Добавяме новото поле към обекта и го закръгляме
        return {
            ...maxRecord,
            avgWindSpeedAroundPeak: Math.round(avgWindSpeedAroundPeak * 100) / 100
        };
    });

    return dailyMaxRecords;
}

async function saveRecordsToDatabase(records) {
    if (!records || records.length === 0) {
        return { success: false, savedCount: 0 };
    }

    let historyArray = await redis.get(MAX_WIND_HISTORY_KEY) || [];

    let updatedCount = 0;
    records.forEach(record => {
        const recordDate = record.timestamp.split('T')[0];
        const existingEntryIndex = historyArray.findIndex(
            item => item.timestamp.split('T')[0] === recordDate
        );

        if (existingEntryIndex !== -1) {
            if (record.windSpeedKnots > historyArray[existingEntryIndex].windSpeedKnots) {
                historyArray[existingEntryIndex] = record;
                updatedCount++;
            }
        } else {
            historyArray.push(record);
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        historyArray.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        await redis.set(MAX_WIND_HISTORY_KEY, JSON.stringify(historyArray));
        console.log(`${updatedCount} записа бяха добавени/обновени в Redis.`);
    } else {
        console.log('Нямаше нужда от обновяване на записи в Redis.');
    }

    return { success: true, savedCount: updatedCount };
}

/**
 * Core logic for processing max wind data.
 */
export async function processMaxWind() {
    const observations = await fetchHistoricalData();
    console.log(`Successfully fetched ${observations.length} records.`);

    const maxWindRecords = findMaxWindForEachDay(observations);

    if (maxWindRecords.length > 0) {
        console.log(`Found max wind records for ${maxWindRecords.length} days.`);
        const result = await saveRecordsToDatabase(maxWindRecords);
        return {
            success: true,
            message: `Processing finished. ${result.savedCount} records were updated.`,
            data: maxWindRecords
        };
    } else {
        console.log('No records found for processing.');
        return { success: true, message: 'No new records found.' };
    }
}

/**
 * Vercel Serverless Function handler.
 */
export default async function handler(request, response) {
    try {
        const result = await processMaxWind();
        return response.status(200).json(result);
    } catch (error) {
        console.error('Error in process-max-wind cron job:', error);
        return response.status(500).json({ success: false, message: 'Internal Server Error', error: error.message });
    }
}
