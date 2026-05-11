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

// Fallback prediction logic using the calibrated score-based map
// Calibrated 2026-05 based on 112 real station records (Aug 2025 – May 2026):
// - Spot median: 16.7 kn across all days; 54% of days are 16+ kn
// - Monthly medians: Aug/Sep ~20 kn, Oct/Nov ~13-15 kn, Apr ~15.5 kn, May ~19 kn
// - Thermally driven days (dir 60-115°) avg 17.7 kn; SE (115-150°) avg 15.75 kn; W/NW avg 11 kn
// - Score 9-15 range was 0.5-1 kn below real medians; adjusted upward
// - Apr20 treated as meteorological outlier (score=11, real=20 kn, direction-independent)
function predictWindSpeedWithScore(overallScore) {
    const scoreToWindMap = [
        [-15, 3,  6],
        [-12, 4,  7],
        [-9,  5,  8],
        [-6,  6,  9],
        [-3,  7, 10],
        [0,   9, 13],  // avg=11 kn — poor day (overcast, low thermals)
        [3,  11, 15],  // avg=13 kn
        [6,  12, 16],  // avg=14 kn — Oct/Nov thermally driven median ~15 kn
        [9,  14, 17],  // avg=15.5 kn (+1 vs prev) — Oct/Nov E-wind mean=15.1
        [12, 15, 18],  // avg=16.5 kn (+1 vs prev) — toward spot median 16.7
        [15, 17, 20],  // avg=18.5 kn (+1.5 vs prev) — Apr/May good days
        [18, 19, 22],  // avg=20.5 kn — Aug/Sep thermally driven median ~20.5
        [21, 21, 24]
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
        scores.pressure_drop_score, // New
        scores.humidity_score, // New
        scores.precipitation_probability_score // New
    ];

    let correction = (coeffs.intercept || 0) +
        (coeffs.cloud_cover || 0) * features[0] +
        (coeffs.temp_diff || 0) * features[1] +
        (coeffs.wind_speed || 0) * features[2] +
        (coeffs.wind_direction || 0) * features[3] +
        (coeffs.suck_effect || 0) * features[4] +
        (coeffs.pressure_drop || 0) * features[5] + // New
        (coeffs.humidity || 0) * features[6] + // New
        (coeffs.precipitation || 0) * features[7]; // New

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

    // 3. Use the trained model only if it has real data for this exact month.
    let isLimitedCorrection = false;
    const predictionMonth = date ? new Date(date).getMonth() + 1 : null;
    const modelHasOwnData = model && model.coefficients && model.sourceMonth === predictionMonth;

    if (modelHasOwnData) {
        console.log(`Using model for month ${predictionMonth} (own data, max correction: 20)`);
        finalPrediction = predictWindSpeedWithModel(scores, model, 20);
    } else {
        // No real data for this month — use baseline only, no ML correction
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
