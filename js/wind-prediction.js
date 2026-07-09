import { KNOTS_TO_MS } from './constants.js';
import { translations } from './translations.js';
import { state } from './state.js';

// Helper function to parse predicted wind range string
export function parsePredictedWindRange(rangeString) {
    const knotsPattern = /(\d+)-(\d+)\s*(?:knots|възли)/;
    const msPattern = /\((\d+\.?\d*)-(\d+\.?\d*)\s*(?:m\/s|м\/с)\)/;

    const knotsMatch = rangeString.match(knotsPattern);
    const msMatch = rangeString.match(msPattern);

    let knots = { min: 0, max: 0 };
    let ms = { min: 0, max: 0 };

    if (knotsMatch) {
        knots.min = parseInt(knotsMatch[1], 10);
        knots.max = parseInt(knotsMatch[2], 10);
    }
    if (msMatch) {
        ms.min = parseFloat(msMatch[1]);
        ms.max = parseFloat(msMatch[2]);
    }

    return {
        knots: knots,
        ms: ms,
        text: rangeString
    };
}

// Baseline score-to-wind lookup table.
// v3 score range is -25 to +32.25 (added lapse_rate, vpd, strat_cloud).
// The new factors add up to max +7 / min -4.5, so the same real-wind outcome
// now maps to a higher score. The table is extended at both ends accordingly
// while keeping the core calibrated segment (scores -15 to +21) unchanged.
function predictWindSpeedWithScore(overallScore) {
    const scoreToWindMap = [
        // Extended low end: new factors can push score down to -25
        [-25,  2,  5],
        [-22,  2,  5],
        [-19,  3,  6],
        [-15,  3,  6],
        [-12,  4,  7],
        [-9,   5,  8],
        [-6,   6,  9],
        [-3,   7, 10],
        [0,    9, 13],  // avg=11 kn — poor day
        [3,   11, 15],  // avg=13 kn
        [6,   12, 16],  // avg=14 kn — Oct/Nov median ~15 kn
        [9,   14, 17],  // avg=15.5 kn
        [12,  15, 18],  // avg=16.5 kn — toward spot median 16.7
        [15,  17, 20],  // avg=18.5 kn — Apr/May good days
        [18,  19, 22],  // avg=20.5 kn — Aug/Sep thermally driven median
        [21,  21, 24],
        // Extended high end: new factors can push score up to +32.25
        [24,  22, 25],
        [27,  23, 26],
        [30,  24, 27],
        [33,  25, 28],
    ];
    let p1 = scoreToWindMap[0], p2 = scoreToWindMap[scoreToWindMap.length - 1];

    if (overallScore <= p1[0]) {
        const min = p1[1], max = p1[2];
        return { min, max, baselineAvgKnots: (min + max) / 2, correction: 0 };
    }
    if (overallScore >= p2[0]) {
        const min = p2[1], max = p2[2];
        return { min, max, baselineAvgKnots: (min + max) / 2, correction: 0 };
    }

    for (let i = 0; i < scoreToWindMap.length - 1; i++) {
        if (overallScore >= scoreToWindMap[i][0] && overallScore < scoreToWindMap[i + 1][0]) {
            p1 = scoreToWindMap[i];
            p2 = scoreToWindMap[i + 1];
            break;
        }
    }

    const progress = (overallScore - p1[0]) / (p2[0] - p1[0]);
    const minKnots = p1[1] + (p2[1] - p1[1]) * progress;
    const maxKnots = minKnots + 3;

    return {
        min: minKnots,
        max: maxKnots,
        baselineAvgKnots: (minKnots + maxKnots) / 2,
        correction: 0
    };
}

// Main prediction function that uses the trained model
function predictWindSpeedWithModel(scores, model, maxCorrection = 20) {
    // 1. Get the baseline prediction from the score-based system
    const baselinePrediction = predictWindSpeedWithScore(scores.overallScore);
    const baselineAvgKnots = baselinePrediction.baselineAvgKnots;

    // 2. Calculate the correction from the model
    const coeffs = model.coefficients;
    const features = [
        scores.cloud_cover_score,
        scores.temp_diff_score,
        scores.wind_speed_score,
        scores.wind_direction_score,
        scores.suck_effect_score_value,
        scores.pressure_drop_score,
        scores.humidity_score,
        scores.precipitation_probability_score,
        scores.lapse_rate_score  || 0,
        scores.vpd_score         || 0,
        scores.strat_cloud_score || 0,
    ];

    let correction = (coeffs.intercept || 0) +
        (coeffs.cloud_cover || 0)   * features[0] +
        (coeffs.temp_diff || 0)     * features[1] +
        (coeffs.wind_speed || 0)    * features[2] +
        (coeffs.wind_direction || 0)* features[3] +
        (coeffs.suck_effect || 0)   * features[4] +
        (coeffs.pressure_drop || 0) * features[5] +
        (coeffs.humidity || 0)      * features[6] +
        (coeffs.precipitation || 0) * features[7] +
        (coeffs.lapse_rate || 0)    * features[8] +
        (coeffs.vpd || 0)           * features[9] +
        (coeffs.strat_cloud || 0)   * features[10];

    // Clamp the correction to a reasonable range to prevent extreme adjustments
    correction = Math.max(-maxCorrection, Math.min(maxCorrection, correction));

    // 3. Apply the clamped correction to the baseline
    const correctedKnots = baselineAvgKnots + correction;

    // 4. Define the final range
    const minKnots = Math.max(0, correctedKnots - 1.5);
    const maxKnots = minKnots + 3;

    return {
        min: minKnots,
        max: maxKnots,
        baselineAvgKnots: baselineAvgKnots,
        correction: correction
    };
}

export function predictWindSpeedRange(scores, monthlyModels, date) {
    const T = translations[state.currentLang];

    // 1. Get the raw, score-based prediction first.
    const rawPrediction = predictWindSpeedWithScore(scores.overallScore);
    const rawMinKnots = Math.round(rawPrediction.min);
    const rawMaxKnots = Math.round(rawPrediction.max);
    const rawAvgPredictedKnots = (rawMinKnots + rawMaxKnots) / 2;

    let finalPrediction;
    let model = null;

    // 2. Select the model for the correct month
    if (date && monthlyModels) {
        const month = new Date(date).getMonth() + 1; // 1-12
        model = monthlyModels[month];
    }

    // 3. Apply correction if the model was trained on this month's own data (cross-year aggregated).
    //    isFallback=true means no own-month records exist at all → use baseline only.
    let isLimitedCorrection = false;
    const predictionMonth = date ? new Date(date).getMonth() + 1 : null;
    const modelHasOwnData = model && model.coefficients && model.sourceMonth === predictionMonth;

    if (modelHasOwnData) {
        const ownRec = model.ownMonthRecords != null ? model.ownMonthRecords : '?';
        const poolRec = model.recordsAnalyzed || '?';
        console.log(`Using model for month ${predictionMonth} (own=${ownRec} pool=${poolRec} records, max correction: 20)`);
        finalPrediction = predictWindSpeedWithModel(scores, model, 20);
    } else {
        // No own-month records at all — use baseline only, no ML correction
        console.log(`No own-month model for month ${predictionMonth}, using baseline only`);
        isLimitedCorrection = true;
        finalPrediction = {
            min: rawPrediction.min,
            max: rawPrediction.max,
            baselineAvgKnots: rawPrediction.baselineAvgKnots,
            correction: 0
        };
    }

    // 4. Finalize values for display.
    const finalMinKnots = Math.round(finalPrediction.min);
    const finalMaxKnots = Math.round(finalPrediction.max);
    const avgPredictedKnots = (finalMinKnots + finalMaxKnots) / 2;
    const avgPredictedMs = avgPredictedKnots * 0.5144;

    // 5. Return both raw and corrected values.
    return {
        pKnots_min: finalMinKnots,
        pKnots_max: finalMaxKnots,
        avgPredictedKnots, // This is the corrected average
        rawAvgPredictedKnots, // This is the raw, uncorrected average
        avgPredictedMs,
        text: `${finalMinKnots}-${finalMaxKnots} ${T.knotsUnit} (${avgPredictedMs.toFixed(1)} ${T.msUnit})`,
        baselineAvgKnots: finalPrediction.baselineAvgKnots,
        correction: finalPrediction.correction,
        isLimitedCorrection: isLimitedCorrection
    };
}
