import { translations } from './translations.js';
import { state } from './state.js';

// Helper function to calculate the average of a set of angles (wind directions)
function getAverageDirection(angles) {
    let sumX = 0;
    let sumY = 0;

    angles.forEach(angle => {
        const rad = angle * (Math.PI / 180);
        sumX += Math.cos(rad);
        sumY += Math.sin(rad);
    });

    const avgRad = Math.atan2(sumY, sumX);
    const avgDeg = avgRad * (180 / Math.PI);

    return (avgDeg + 360) % 360; // Normalize to 0-360
}

// Helper icon functions

export function getWindDirectionName(degrees) {
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

export function getWindSpeedScore(windSpeed) {
    let score = 0;
    let icon = '';
    if (windSpeed >= 15 && windSpeed <= 30) { score = 3.5; icon = '✅'; }
    else if (windSpeed > 30 && windSpeed <= 40) { score = 2; icon = '⚠️'; }
    else if (windSpeed < 15 && windSpeed >= 5) { score = 1; icon = '❌'; }
    else if (windSpeed < 5) { score = 0; icon = '❌'; }
    else { score = -1; icon = '❌'; }
    return { score, icon };
}

export function getWindDirectionScore(dir, T) {
    let score = 0;
    let textKey = '';

    if (dir >= 45 && dir <= 90) { // NE-E (Ideal)
        score = 3;
        textKey = 'windDirNE_E_Ideal';
    } else if (dir >= 15 && dir < 45) { // E-NE (almost Ideal)
        score = 2;
        textKey = 'windDirE_SE_Acceptable'; // Assuming E-SE is the intended key
    } else if (dir > 90 && dir < 115) { // E-NE (almost Ideal)
        score = 2;
        textKey = 'windDirE_SE_Acceptable'; // Assuming E-SE is the intended key
    } else if (dir > 135 && dir <= 115) { // E-NE (almost Ideal)
        score = 1;
        textKey = 'windDirE_SE_Acceptable'; // Assuming E-SE is the intended key
    } else if ((dir > 115 && dir <= 135) || (dir >= 0 && dir < 45)) { // E-SE and N-NE (Not good)
        score = -2;
        textKey = (dir > 115) ? 'windDirE_SE_Acceptable' : 'windDirN_NE_Acceptable';
    } else if (dir > 135 && dir < 225) { // SE-S-SW (Not good at all)
        score = -4;
        textKey = 'windDirSE_S_SW_Neutral';
    } else { // W, NW (Bad)
        score = -8;
        textKey = 'windDirW_NW_Bad';
    }

    const description = T[textKey] || '';
    return { score, description };
}

export function calculateAfternoonWindDirection(weatherData, date) {
    const afternoonWindDirections = [];
    if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.winddirection_80m) {
        weatherData.hourly.time.forEach((datetime, index) => {
            const entryDate = datetime.split('T')[0];
            if (entryDate === date) {
                const hour = parseInt(datetime.split('T')[1].split(':')[0]);
                if (hour >= 13 && hour <= 17) { // Thermal wind window
                    afternoonWindDirections.push(weatherData.hourly.winddirection_80m[index]);
                }
            }
        });
    }

    if (afternoonWindDirections.length > 0) {
        return Math.round(getAverageDirection(afternoonWindDirections));
    }
    return null;
}

export function getSuckEffectIcon(score) {
    if (score >= 1.5 || score === 1) return '✅';
    if (score === 0.5) return '⚠️';
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

/**
 * Scores the pressure drop between morning and afternoon.
 * A larger drop indicates a stronger thermal effect.
 * @param {number} pressureDrop - The difference in hPa.
 * @returns {object} { score, icon }
 */
export function getPressureDropScore(pressureDrop) {
    if (pressureDrop >= 4) return { score: 3, icon: '✅' };    // Strong thermal effect
    if (pressureDrop >= 2) return { score: 1.5, icon: '✅' };  // Moderate thermal effect
    if (pressureDrop >= 0) return { score: 0, icon: '⚠️' };   // Weak or no effect
    return { score: -2, icon: '❌' }; // Negative effect (e.g., frontal system)
}

/**
 * Scores the average afternoon humidity.
 * Lower humidity allows for faster heating of the land.
 * @param {number} humidity - Average afternoon humidity in %.
 * @returns {object} { score, icon }
 */
export function getHumidityScore(humidity) {
    if (humidity < 40) return { score: 2, icon: '✅' };      // Very dry, good for heating
    if (humidity < 60) return { score: 1, icon: '✅' };      // Moderately dry
    if (humidity < 80) return { score: -1, icon: '⚠️' };     // Quite humid, may inhibit heating
    return { score: -2, icon: '❌' };      // Very humid, bad for thermal
}

/**
 * Scores the maximum precipitation probability in the afternoon.
 * Rain is a thermal killer.
 * @param {number} probability - Max probability in %.
 * @returns {object} { score, icon }
 */
export function getPrecipitationScore(probability) {
    if (probability <= 10) return { score: 1, icon: '✅' };   // Very unlikely to rain
    if (probability <= 30) return { score: 0, icon: '⚠️' };   // Low chance
    if (probability <= 50) return { score: -2, icon: '❌' };  // Possible rain, concerning
    return { score: -4, icon: '❌' };  // High chance of rain, very bad
}
