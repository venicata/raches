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

// Fallback prediction logic using the old score-based map
function predictWindSpeedWithScore(overallScore) {
    const scoreToWindMap = [
        [-15, 0, 3],
        [-12, 1, 4],
        [-9, 2, 5],
        [-6, 3, 6],
        [-3, 4, 7],
        [0, 5, 8],
        [3, 7, 10],
        [6, 9, 12],
        [9, 11, 14],
        [12, 14, 17],
        [15, 17, 20],
        [18, 20, 23],
        [21, 22, 25]
    ];
    let p1 = scoreToWindMap[0], p2 = scoreToWindMap[scoreToWindMap.length - 1];

    if (overallScore <= p1[0]) return { min: p1[1], max: p1[2] };
    if (overallScore >= p2[0]) return { min: p2[1], max: p2[2] };

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

    return { min: minKnots, max: maxKnots };
}

// Main prediction function that uses the trained model
function predictWindSpeedWithModel(scores, model) {
    // 1. Get the baseline prediction from the score-based system
    const baselinePrediction = predictWindSpeedWithScore(scores.overallScore);
    const baselineAvgKnots = (baselinePrediction.min + baselinePrediction.max) / 2;

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

    // Clamp the correction to a reasonable range (e.g., +/- 5 knots) to prevent extreme adjustments
    const MAX_CORRECTION = 4;
    correction = Math.max(-MAX_CORRECTION, Math.min(MAX_CORRECTION, correction));

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

export function predictWindSpeedRange(scores, model) {
    const T = translations[state.currentLang];

    // 1. Get the raw, score-based prediction first.
    const rawPrediction = predictWindSpeedWithScore(scores.overallScore);
    const rawMinKnots = Math.round(rawPrediction.min);
    const rawMaxKnots = Math.round(rawPrediction.max);
    const rawAvgPredictedKnots = (rawMinKnots + rawMaxKnots) / 2;

    let finalPrediction;

    // 2. Use the trained model to get the corrected prediction if it exists.
    if (model && model.coefficients) {
        console.log('Using model for prediction');
        finalPrediction = predictWindSpeedWithModel(scores, model);
    } else {
        // Fallback to the raw score-based system if no model is available.
        console.log('Using score-based prediction');
        finalPrediction = rawPrediction;
    }

    // 3. Finalize values for display.
    const finalMinKnots = Math.round(finalPrediction.min);
    const finalMaxKnots = Math.round(finalPrediction.max);
    const avgPredictedKnots = (finalMinKnots + finalMaxKnots) / 2;
    const avgPredictedMs = avgPredictedKnots * 0.5144;

    // 4. Return both raw and corrected values.
    return {
        pKnots_min: finalMinKnots,
        pKnots_max: finalMaxKnots,
        avgPredictedKnots, // This is the corrected average
        rawAvgPredictedKnots, // This is the raw, uncorrected average
        avgPredictedMs,
        text: `${finalMinKnots}-${finalMaxKnots} ${T.knotsUnit} (${avgPredictedMs.toFixed(1)} ${T.msUnit})`,
        baselineAvgKnots: finalPrediction.baselineAvgKnots,
        correction: finalPrediction.correction
    };
}
