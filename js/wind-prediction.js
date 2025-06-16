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

export function predictWindSpeedRange(baseWindSpeedKmH, overallScore, suckEffectScore, windDirection) {
    const T = translations[state.currentLang];

    const PERFECT_DAY_SCORE_THRESHOLD = 16;
    if (overallScore >= PERFECT_DAY_SCORE_THRESHOLD) {
        const minKnots = 20;
        const maxKnots = 25;
        const minMs = (minKnots * KNOTS_TO_MS).toFixed(1);
        const maxMs = (maxKnots * KNOTS_TO_MS).toFixed(1);
        return `${minKnots}-${maxKnots} ${T.knotsUnit} (${minMs}-${maxMs} ${T.msUnit})`;
    }

    const baseKnots = baseWindSpeedKmH * 0.539957;
    let thermalAdditiveKnots = 0;

    const MIN_APP_SCORE = -8.5;
    const MAX_APP_SCORE = 17.25;
    const forecastHighThreshold = 10;
    const forecastMidThreshold = 5;
    const forecastLowThreshold = 0;

    let baseThermal_start, baseThermal_end, suckMultiplier_start, suckMultiplier_end;
    let tier_lower_bound, tier_upper_bound;

    if (overallScore >= forecastHighThreshold) {
        tier_lower_bound = forecastHighThreshold; tier_upper_bound = MAX_APP_SCORE;
        baseThermal_start = 7.0; baseThermal_end = 8.0;
        suckMultiplier_start = 2.5; suckMultiplier_end = 3.0;
    } else if (overallScore >= forecastMidThreshold) {
        tier_lower_bound = forecastMidThreshold; tier_upper_bound = forecastHighThreshold;
        baseThermal_start = 3.0; baseThermal_end = 6.0;
        suckMultiplier_start = 1.5; suckMultiplier_end = 2.2;
    } else if (overallScore >= forecastLowThreshold) {
        tier_lower_bound = forecastLowThreshold; tier_upper_bound = forecastMidThreshold;
        baseThermal_start = 1.0; baseThermal_end = 2.5;
        suckMultiplier_start = 1.0; suckMultiplier_end = 1.2;
    } else {
        tier_lower_bound = MIN_APP_SCORE; tier_upper_bound = forecastLowThreshold;
        baseThermal_start = 0.0; baseThermal_end = 0.5;
        suckMultiplier_start = 0.2; suckMultiplier_end = 0.8;
    }

    let progress = 0;
    const tier_span = tier_upper_bound - tier_lower_bound;
    if (tier_span > 0) {
        progress = (overallScore - tier_lower_bound) / tier_span;
    }
    progress = Math.min(1, Math.max(0, progress));

    const currentBaseThermal = baseThermal_start + progress * (baseThermal_end - baseThermal_start);
    const currentSuckMultiplier = suckMultiplier_start + progress * (suckMultiplier_end - suckMultiplier_start);
    
    thermalAdditiveKnots = currentBaseThermal + suckEffectScore * currentSuckMultiplier;

    let minKnots = baseKnots + thermalAdditiveKnots * 0.6;
    let maxKnots = baseKnots + thermalAdditiveKnots;

    if (baseKnots < 5 && thermalAdditiveKnots > 7) {
        minKnots = Math.max(minKnots, thermalAdditiveKnots * 0.5);
    }

    const isOptimalDirection = (windDirection >= 135 && windDirection <= 225);
    if (isOptimalDirection && thermalAdditiveKnots >= 4) {
        minKnots = Math.min(minKnots + 1, maxKnots -1); 
        maxKnots += 1;
    }
    
    const realisticMaxKnots = 28;
    maxKnots = Math.min(maxKnots, realisticMaxKnots);
    minKnots = Math.min(minKnots, maxKnots);

    if (thermalAdditiveKnots < 3 && minKnots > baseKnots + 1.5) {
         minKnots = baseKnots + 1.5;
    }
    minKnots = Math.max(minKnots, baseKnots); 
    minKnots = Math.min(minKnots, maxKnots);

    if (maxKnots - minKnots < 2 && thermalAdditiveKnots > 0.5) {
        if (minKnots > baseKnots + 1 && minKnots > 2) minKnots = Math.max(0, maxKnots - 2);
        else maxKnots = minKnots + 2;
    }
    if (maxKnots < minKnots) maxKnots = minKnots; 

    // --- Global adjustment requested by user ---
    minKnots -= 2.5;
    maxKnots -= 2.5;
    // --- End of global adjustment ---

    const finalMinKnots = Math.max(0, Math.round(minKnots));
    const finalMaxKnots = Math.max(0, Math.round(maxKnots));

    if (finalMinKnots === 0 && finalMaxKnots === 0 && baseKnots < 1) {
         return `0-0 ${T.knotsUnit} (0.0-0.0 ${T.msUnit})`
    }

    const displayMinMs = (finalMinKnots * KNOTS_TO_MS).toFixed(1);
    const displayMaxMs = (finalMaxKnots * KNOTS_TO_MS).toFixed(1);

    return `${finalMinKnots}-${finalMaxKnots} ${T.knotsUnit} (${displayMinMs}-${displayMaxMs} ${T.msUnit})`;
}
