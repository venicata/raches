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

export function predictWindSpeedRange(overallScore) {
    const T = translations[state.currentLang];

    // Define score-to-wind mapping points for interpolation.
    // Each point is [score, minKnots, maxKnots]
    const scoreToWindMap = [
        [-14.5, 0, 4],   // Worst score
        [-5, 2, 7],
        [2.5, 4, 10],  // Low forecast threshold
        [7, 8, 14],    // Mid forecast threshold
        [11, 13, 19],  // High forecast threshold
        [16, 17, 23],  // Perfect day threshold
        [17.25, 18, 25] // Max possible score
    ];

    let minKnots, maxKnots;

    // Find the two points to interpolate between
    let p1 = scoreToWindMap[0];
    let p2 = scoreToWindMap[scoreToWindMap.length - 1];

    if (overallScore <= p1[0]) {
        minKnots = p1[1];
        maxKnots = p1[2];
    } else if (overallScore >= p2[0]) {
        minKnots = p2[1];
        maxKnots = p2[2];
    } else {
        for (let i = 0; i < scoreToWindMap.length - 1; i++) {
            if (overallScore >= scoreToWindMap[i][0] && overallScore < scoreToWindMap[i + 1][0]) {
                p1 = scoreToWindMap[i];
                p2 = scoreToWindMap[i + 1];
                break;
            }
        }

        const scoreRange = p2[0] - p1[0];
        const progress = (overallScore - p1[0]) / scoreRange;

        // Linear interpolation for min and max knots
        const minKnotsRange = p2[1] - p1[1];
        minKnots = p1[1] + (minKnotsRange * progress);

        const maxKnotsRange = p2[2] - p1[2];
        maxKnots = p1[2] + (maxKnotsRange * progress);
    }

    const finalMinKnots = Math.round(minKnots);
    const finalMaxKnots = Math.round(maxKnots);

    // Ensure min is not greater than max
    const displayMinKnots = Math.min(finalMinKnots, finalMaxKnots);

    const displayMinMs = (displayMinKnots * KNOTS_TO_MS).toFixed(1);
    const displayMaxMs = (finalMaxKnots * KNOTS_TO_MS).toFixed(1);

    return `${displayMinKnots}-${finalMaxKnots} ${T.knotsUnit} (${displayMinMs}-${displayMaxMs} ${T.msUnit})`;
}
