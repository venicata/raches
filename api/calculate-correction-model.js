import { Redis } from '@upstash/redis';
import { create, all } from 'mathjs';
import md5 from 'md5';

const redis = Redis.fromEnv();
const math = create(all, {});
math.config({
    matrix: 'Matrix' // Configure math.js to use Matrix type
});

const FORECAST_HISTORY_KEY = 'rachesForecastHistory';
const REAL_WIND_HISTORY_KEY = 'max_wind_history';
const MODEL_KEY = 'prediction_model_v7'; // v7: fix intercept ridge, NaN guard, UTC month, tail-slice neighbours, ?? for predictedKnots

/**
 * Core logic for calculating the correction model.
 */
export async function calculateCorrectionModel() {
    // 1. Fetch and parse data from Redis
    const [forecastHistoryRaw, realWindHistoryRaw] = await Promise.all([
        redis.get(FORECAST_HISTORY_KEY),
        redis.get(REAL_WIND_HISTORY_KEY)
    ]);

    let forecastHistory = forecastHistoryRaw ? (typeof forecastHistoryRaw === 'string' ? JSON.parse(forecastHistoryRaw) : forecastHistoryRaw) : [];
    let realWindHistory = realWindHistoryRaw ? (typeof realWindHistoryRaw === 'string' ? JSON.parse(realWindHistoryRaw) : realWindHistoryRaw) : [];

    if (!Array.isArray(forecastHistory)) forecastHistory = [forecastHistory];
    if (!Array.isArray(realWindHistory)) realWindHistory = [realWindHistory];

    if (forecastHistory.length === 0 || realWindHistory.length === 0) {
        return { success: true, message: 'Insufficient data for model generation.' };
    }

    // 2. Combine and prepare data
    const forecastMap = new Map(forecastHistory.map(f => [f.date, f]));
    const realWindMap = new Map(realWindHistory.map(r => [r.timestamp.replace(' ', 'T').split('T')[0], r]));

    const monthlyTrainingData = {};
    let unmatchedRecords = 0;

    for (const [date, realWindRecord] of realWindMap.entries()) {
        const forecast = forecastMap.get(date);

        if (forecast) {
            const realKnots = realWindRecord.windSpeedKnots;

            const features = [
                forecast.cloud_cover_score,
                forecast.temp_diff_score,
                forecast.wind_speed_score,
                forecast.wind_direction_score,
                forecast.suck_effect_score_value,
                forecast.pressure_drop_score,
                forecast.humidity_score,
                forecast.precipitation_probability_score,
                forecast.lapse_rate_score,   // v3 new
                forecast.vpd_score,          // v3 new
                forecast.strat_cloud_score,  // v3 new
            ].map(v => (typeof v === 'number' && isFinite(v) ? v : 0));

            const predictedKnots = forecast.rawAvgPredictedKnots ?? forecast.avgPredictedKnots;
            if (!isFinite(predictedKnots) || !isFinite(realKnots)) continue;
            const wind_diff = realKnots - predictedKnots;

            const month = new Date(realWindRecord.timestamp).getUTCMonth() + 1; // 1-12
            if (!monthlyTrainingData[month]) {
                monthlyTrainingData[month] = [];
            }
            monthlyTrainingData[month].push({ features, target: wind_diff });

        } else {
            unmatchedRecords++;
        }
    }

    const NUM_FEATURES = 11; // v3: +lapse_rate, +vpd, +strat_cloud
    // Minimum records to consider a month's own data as the primary source
    const MIN_OWN_RECORDS = NUM_FEATURES + 1;
    // Target pool size: if own data is below this, blend in neighbour months
    const TARGET_POOL_SIZE = 20;

    const monthlyModels = {};
    const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);

    // Cyclic distance between two months (1-12)
    function cyclicDist(a, b) {
        const d = Math.abs(a - b);
        return Math.min(d, 12 - d);
    }

    // Build an aggregated training pool for a given month by blending data from
    // all years for that month first, then adding neighbour months if still thin.
    // Records from the target month get weight 1.0; neighbours are down-weighted
    // by replicating them (weight applied by including fewer copies as distance grows).
    function buildPool(targetMonth) {
        const ownData = monthlyTrainingData[targetMonth] || [];
        // Already aggregated across all years — own month from any year counts equally
        let pool = [...ownData];

        if (pool.length >= TARGET_POOL_SIZE) {
            return { pool, sourceMonth: targetMonth, blendedMonths: [] };
        }

        // Gather neighbour months sorted by cyclic distance
        const neighbours = allMonths
            .filter(m => m !== targetMonth && monthlyTrainingData[m] && monthlyTrainingData[m].length > 0)
            .map(m => ({ month: m, dist: cyclicDist(targetMonth, m) }))
            .sort((a, b) => a.dist - b.dist || a.month - b.month);

        const blendedMonths = [];

        for (const { month: nm, dist } of neighbours) {
            if (pool.length >= TARGET_POOL_SIZE) break;
            const neighbourData = monthlyTrainingData[nm];
            // Down-weight by distance: distance 1 → full copy, distance 2 → half, 3 → third, etc.
            const keepFraction = 1 / dist;
            const keepCount = Math.max(1, Math.round(neighbourData.length * keepFraction));
            // Take a deterministic slice (first N records after sorting by insertion order)
            const slice = neighbourData.slice(-keepCount);
            pool = pool.concat(slice);
            blendedMonths.push({ month: nm, dist, recordsAdded: slice.length });
        }

        const sourceMonth = ownData.length >= MIN_OWN_RECORDS ? targetMonth
            : (neighbours.length > 0 ? neighbours[0].month : targetMonth);

        return { pool, sourceMonth, blendedMonths };
    }

    // Check if any data exists at all
    const totalRecords = Object.values(monthlyTrainingData).reduce((s, a) => s + a.length, 0);
    if (totalRecords === 0) {
        return { success: true, message: 'Insufficient data for any month to generate models.' };
    }

    for (const month of allMonths) {
        const { pool, sourceMonth, blendedMonths } = buildPool(month);

        if (pool.length < MIN_OWN_RECORDS) {
            console.log(`Month ${month}: Only ${pool.length} records after blending, skipping.`);
            continue;
        }

        const isFallback = sourceMonth !== month;
        if (blendedMonths.length > 0) {
            console.log(`Month ${month}: ${(monthlyTrainingData[month] || []).length} own records + blended from [${blendedMonths.map(b => `M${b.month}(+${b.recordsAdded})`).join(', ')}] → pool=${pool.length}`);
        }

        // 3. Build matrices and calculate coefficients via ridge regression
        const X = math.matrix(pool.map(d => [1, ...d.features]), 'dense');
        const y = math.matrix(pool.map(d => [d.target]), 'dense');
        const Xt = math.transpose(X);
        let XtX = math.multiply(Xt, X);

        const lambda = 0.1;
        const I = math.identity(XtX.size()[0]);
        I.set([0, 0], 0); // don't penalize the intercept (standard ridge)
        XtX = math.add(XtX, math.multiply(I, lambda));

        let XtX_inv;
        try {
            XtX_inv = math.inv(XtX);
        } catch (error) {
            console.error(`Error inverting matrix for month ${month}:`, error);
            continue;
        }

        const XtX_inv_Xt = math.multiply(XtX_inv, Xt);
        const coefficients = math.flatten(math.multiply(XtX_inv_Xt, y)).toArray();

        const ownCount = (monthlyTrainingData[month] || []).length;
        const model = {
            version: '7.0-aggregated-cross-year',
            sourceMonth: sourceMonth,
            isFallback: isFallback,
            blendedMonths: blendedMonths,
            lastUpdated: new Date().toISOString(),
            coefficients: {
                intercept:      Math.round(coefficients[0]  * 100) / 100,
                cloud_cover:    Math.round(coefficients[1]  * 100) / 100,
                temp_diff:      Math.round(coefficients[2]  * 100) / 100,
                wind_speed:     Math.round(coefficients[3]  * 100) / 100,
                wind_direction: Math.round(coefficients[4]  * 100) / 100,
                suck_effect:    Math.round(coefficients[5]  * 100) / 100,
                pressure_drop:  Math.round(coefficients[6]  * 100) / 100,
                humidity:       Math.round(coefficients[7]  * 100) / 100,
                precipitation:  Math.round(coefficients[8]  * 100) / 100,
                lapse_rate:     Math.round(coefficients[9]  * 100) / 100,
                vpd:            Math.round(coefficients[10] * 100) / 100,
                strat_cloud:    Math.round(coefficients[11] * 100) / 100,
            },
            recordsAnalyzed: pool.length,
            ownMonthRecords: ownCount,
        };
        monthlyModels[month] = model;
    }

    if (Object.keys(monthlyModels).length === 0) {
        return { success: true, message: 'No monthly models were generated due to insufficient data.' };
    }


    await redis.set(MODEL_KEY, JSON.stringify(monthlyModels));

    return { success: true, message: 'Monthly linear regression models trained and saved successfully.', models: monthlyModels };
}

/**
 * Vercel Serverless Function handler.
 */
export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const result = await calculateCorrectionModel();
        return response.status(200).json(result);
    } catch (error) {
        console.error('Error during model calculation:', error);
        return response.status(500).json({ success: false, error: error.message });
    }
}
