// File: api/settings.js
// Stores small app-wide toggles (currently just the forecast-locking behavior)
// as a single JSON object under one Redis key.

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { Redis } from '@upstash/redis';
import { isAdminAuthorized } from './_auth.js';

const redis = Redis.fromEnv();
const SETTINGS_KEY = 'appSettings';

const DEFAULT_SETTINGS = {
    // When true, once a day's real wind data has been recorded, its saved
    // forecast entry is frozen so later model retrains can't overwrite it.
    lockForecastAfterActual: true
};

export async function getSettings() {
    const raw = await redis.get(SETTINGS_KEY);
    const stored = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : {};
    return { ...DEFAULT_SETTINGS, ...stored };
}

export default async function handler(request, response) {
    if (request.method === 'GET') {
        const settings = await getSettings();
        return response.status(200).json(settings);
    }

    if (request.method === 'POST') {
        if (!isAdminAuthorized(request)) {
            return response.status(401).json({ error: 'Unauthorized' });
        }

        const body = request.body || {};
        if (typeof body.lockForecastAfterActual !== 'boolean') {
            return response.status(400).json({ error: 'lockForecastAfterActual must be a boolean' });
        }

        const current = await getSettings();
        const updated = { ...current, lockForecastAfterActual: body.lockForecastAfterActual };
        await redis.set(SETTINGS_KEY, JSON.stringify(updated));

        return response.status(200).json(updated);
    }

    return response.status(405).json({ error: 'Method Not Allowed' });
}
