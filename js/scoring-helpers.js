// Helper icon functions

export function getWindDirectionScore(degrees) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    // Ensure degrees are within 0-359 range
    const normalizedDegrees = (degrees % 360 + 360) % 360;
    const index = Math.round(normalizedDegrees / 45) % 8;
    const direction = directions[index];
    return { direction: direction };
}
export function getWindDirIcon(score) { // Based on windDirectionScore logic
    if (score >= 1) return '✅';
    if (score === 0) return '⚠️'; // Neutral or warning for 0 score
    return '❌';
}

export function getSuckEffectIcon(score) {
    if (score >= 2) return '✅';
    if (score === 1) return '⚠️';
    return '❌';
}

// Helper functions for granular scoring
export function getCloudCoverScore(cloudCover) {
    if (cloudCover <= 5) return { score: 5, icon: '✅' };    // Max positive score +5
    if (cloudCover <= 10) return { score: 4.5, icon: '✅' };
    if (cloudCover <= 15) return { score: 4, icon: '✅' };
    if (cloudCover <= 20) return { score: 4, icon: '✅' };
    if (cloudCover <= 30) return { score: 3.5, icon: '✅' }; 
    if (cloudCover <= 40) return { score: 3, icon: '⚠️' };
    if (cloudCover <= 50) return { score: 2, icon: '⚠️' };
    if (cloudCover <= 60) return { score: 1, icon: '⚠️' }; 
    if (cloudCover <= 70) return { score: 0, icon: '❌' };
    if (cloudCover <= 80) return { score: -1, icon: '❌' };
    if (cloudCover <= 90) return { score: -1.5, icon: '❌' };
    return { score: -2, icon: '❌' }; // 91-100%, min negative score -3
}

export function getTempDiffScore(tempDiff) {
    if (tempDiff >= 8) return { score: 5.25, icon: '✅', textKey: 'tempDiffHigh' };    // 3.5 * 1.5
    if (tempDiff >= 7) return { score: 4.75, icon: '✅', textKey: 'tempDiffHigh' };     // 3 * 1.5
    if (tempDiff >= 6) return { score: 4.25, icon: '✅', textKey: 'tempDiffHigh' };   // 2.5 * 1.5
    if (tempDiff >= 5) return { score: 3.75, icon: '✅', textKey: 'tempDiffHigh' };       // 2 * 1.5
    if (tempDiff >= 4) return { score: 3.0, icon: '⚠️', textKey: 'tempDiffMedium' }; // 1.5 * 1.5
    if (tempDiff >= 3) return { score: 2.75, icon: '⚠️', textKey: 'tempDiffMedium' };  // 1 * 1.5
    if (tempDiff >= 2) return { score: 2.25, icon: '⚠️', textKey: 'tempDiffLow' };    // 0.5 * 1.5
    if (tempDiff >= 1) return { score: 1.25, icon: '❌', textKey: 'tempDiffLow' };        // 0 * 1.5 remains 0
    return { score: -1.5, icon: '❌', textKey: 'tempDiffVeryLow' }; // -1 * 1.5
}
