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

    const dailyMaxRecords = Object.values(dailyObservations).map(dayObs => {
        return dayObs.reduce((max, current) => 
            (current.windSpeedKnots > max.windSpeedKnots) ? current : max,
            dayObs[0]
        );
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
 * Основен handler за Vercel Serverless Function.
 */
export default async function handler(request, response) {
    // По желание: Добавете проверка за сигурност, за да сте сигурни, че заявката идва от Vercel Cron
    // if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return response.status(401).json({ error: 'Unauthorized' });
    // }

    try {
        const observations = await fetchHistoricalData();
        console.log(`Успешно изтеглени ${observations.length} записа.`);
        
        const maxWindRecords = findMaxWindForEachDay(observations);
        
        if (maxWindRecords.length > 0) {
            console.log(`Намерени са записи с максимален вятър за ${maxWindRecords.length} дни.`);
            const result = await saveRecordsToDatabase(maxWindRecords);
            return response.status(200).json({ 
                success: true, 
                message: `Обработката завърши. ${result.savedCount} записа бяха обновени.`, 
                data: maxWindRecords 
            });
        } else {
            console.log('Няма намерени записи за обработка.');
            return response.status(200).json({ success: true, message: 'Няма намерени записи.' });
        }

    } catch (error) {
        console.error('Възникна грешка в крон джоба:', error);
        return response.status(500).json({ success: false, message: 'Вътрешна сървърна грешка', error: error.message });
    }
}
