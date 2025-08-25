// File: /api/run-nightly-tasks.js
// This script orchestrates the nightly cron jobs for processing wind data and recalculating the model.

import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

import { processMaxWind } from './process-max-wind.js';
import { calculateCorrectionModel } from './calculate-correction-model.js';
import { predictPeakWindTime } from './predict-peak-wind-time.js';

export default async function handler(request, response) {
    // Security check for Vercel Cron is disabled for manual triggering.
    // if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    //     return response.status(401).json({ error: 'Unauthorized' });
    // }

    console.log('Starting nightly tasks...');
    const results = {};

    try {
        // Step 1: Process max wind data
        console.log('Running processMaxWind...');
        const windResult = await processMaxWind();
        results.processMaxWind = windResult;
        console.log('processMaxWind finished.');

        // Step 2: Calculate correction model
        console.log('Running calculateCorrectionModel...');
        const modelResult = await calculateCorrectionModel();
        results.calculateCorrectionModel = modelResult;
        console.log('calculateCorrectionModel finished.');

        // Step 3: Train Peak Wind Time Model
        console.log('Running predictPeakWindTime model training...');
        const peakTimeResult = await predictPeakWindTime();
        results.predictPeakWindTime = peakTimeResult;
        console.log('predictPeakWindTime model training finished.');

        console.log('Nightly tasks completed successfully.');
        return response.status(200).json({
            success: true,
            message: 'All nightly tasks completed successfully.',
            results
        });

    } catch (error) {
        console.error('An error occurred during nightly tasks:', error);
        return response.status(500).json({
            success: false,
            message: 'An error occurred during the execution of nightly tasks.',
            error: error.message,
            results // Return partial results if any
        });
    }
}
