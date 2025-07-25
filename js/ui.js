import { translations } from './translations.js';
import { state } from './state.js';
import { renderHistoricalChart } from './chart.js';
import { getCloudCoverScore, getTempDiffScore, getWindDirectionScore, getWindDirIcon, getSuckEffectIcon } from './scoring-helpers.js';
import { saveHistoricalEntry } from './api.js';

export function setLanguage(lang) {
    localStorage.setItem('preferredLang', lang);
    if (!translations[lang]) return;
    state.currentLang = lang;
    document.documentElement.lang = lang;

    const T = translations[state.currentLang];
    // Display the scoring legend with the correct translation
    displayScoringLegend(T);

    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        if (translations[lang][key]) {
            // Check if the element has a placeholder attribute to translate
            if (element.hasAttribute('placeholder')) {
                element.placeholder = translations[lang][key];
            } else {
                // Otherwise, translate the innerHTML
                const link = element.querySelector('a');
                if (link && translations[lang][key].includes('{link}')) {
                    element.innerHTML = translations[lang][key].replace('{link}', link.outerHTML);
                } else {
                    element.innerHTML = translations[lang][key];
                }
            }
        }
    });
    document.getElementById('lang-bg').classList.toggle('active', lang === 'bg');
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    
    if (state.resultsContainer && state.resultsContainer.querySelector('.placeholder')) {
         state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderDefault}</p>`;
    }

    const chartTitleEl = document.getElementById('historicalChartTitleKey');
    if (chartTitleEl) {
        chartTitleEl.textContent = translations[state.currentLang].historicalChartTitleKey;
    }
    if (state.historicalChartInstance) { 
        renderHistoricalChart();
    }
}

export async function displayResults(analysisResults) {
    if (!analysisResults || analysisResults.length === 0) {
        state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderDefault}</p>`;
        const chartSection = document.getElementById('chartSection');
        if (chartSection) chartSection.style.display = 'none';
        return;
    }

    state.resultsContainer.innerHTML = '';
    const T = translations[state.currentLang];
    const pointSuffix = T.pointsSuffix || 'pts';

    for (const result of analysisResults) {
        // --- Part 1: Create and display the result card for the UI ---
        const resultCard = document.createElement('div');
        resultCard.classList.add('result-card');

        // --- Determine forecast text, key, and class, with fallback for missing forecast strings ---
        let finalForecastText = result.finalForecast;
        let forecastKey = '';
        let forecastClass = '';

        if (finalForecastText) {
            // Determine key and class from the provided forecast string
            if (finalForecastText === T.forecastHigh) { forecastKey = 'forecastHigh'; forecastClass = 'high'; }
            else if (finalForecastText === T.forecastMid) { forecastKey = 'forecastMid'; forecastClass = 'mid'; }
            else if (finalForecastText === T.forecastLow) { forecastKey = 'forecastLow'; forecastClass = 'low'; }
            else if (finalForecastText === T.forecastBad) { forecastKey = 'forecastBad'; forecastClass = 'bad'; }
            else if (finalForecastText === T.forecastNotSuitableKiting) { 
                forecastKey = 'forecastNotSuitableKiting'; 
                forecastClass = 'bad'; // Use 'bad' class to also trigger 'not-suitable' styling
            }
        }
        
        // Fallback logic if forecast string is missing or doesn't match
        if (!forecastKey) {
            const score = result.score; // Assuming result.score is available
            if (score > 10) { forecastKey = 'forecastHigh'; forecastClass = 'high'; }
            else if (score >= 5) { forecastKey = 'forecastMid'; forecastClass = 'mid'; }
            else if (score > 0) { forecastKey = 'forecastLow'; forecastClass = 'low'; }
            else { forecastKey = 'forecastBad'; forecastClass = 'bad'; }
            finalForecastText = T[forecastKey]; // Get the translated text from the key
        }

        // Set card class
        if (forecastClass) {
            resultCard.classList.add(forecastClass);
            if (forecastClass === 'bad') {
                resultCard.classList.add('not-suitable');
            }
        }

        // --- Get all the translated text components for the card ---
        const pKnots = result.predicted_wind_knots || { min: 0, max: 0 };
        const pMs = result.predicted_wind_ms || { min: 0, max: 0 };
        const predictedWindText = `${T.predictedWindLabel} <b>${pKnots.min.toFixed(1)} - ${pKnots.max.toFixed(1)}</b> ${T.knotsUnit} (${pMs.min.toFixed(1)}-${pMs.max.toFixed(1)} ${T.msUnit})`;
        const cloudCoverText = `${getCloudCoverScore(result.cloud_cover_value).icon} ${T.cloudCoverLabel} ${result.cloud_cover_value}% (${result.cloud_cover_score > 0 ? '+' : ''}${result.cloud_cover_score} ${pointSuffix})`;
        const tempDiffText = `${getTempDiffScore(result.temp_diff_value).icon} ${T.tempDiffDetail.replace('{description}', T[result.temp_diff_description_key] || result.temp_diff_description_key).replace('{value}', result.temp_diff_value.toFixed(1)).replace('{landTemp}', result.air_temp_value.toFixed(1)).replace('{seaTemp}', result.sea_temp_value.toFixed(1))} (${result.temp_diff_score > 0 ? '+' : ''}${result.temp_diff_score} ${pointSuffix})`;
        const windSpeedKnots = result.wind_speed_value * 0.539957;
        const windSpeedMs = result.wind_speed_value * 0.277778;
        const maxWindText = `${result.wind_speed_icon || '❓'} ${T.apiWindSpeedLabel} <b>${windSpeedKnots.toFixed(1)}</b> ${T.knotsUnit} (${windSpeedMs.toFixed(1)} ${T.msUnit}) (${result.wind_speed_score > 0 ? '+' : ''}${result.wind_speed_score} ${pointSuffix})`;
        const windDirResult = getWindDirectionScore(result.wind_direction_value);
        const windDirText = `<div class="wind-direction-container">${getWindDirIcon(result.wind_direction_score)} <span class="wind-arrow" style="transform: rotate(${result.wind_direction_value + 180}deg);"></span> ${T.windDirDetail.replace('{value}', result.wind_direction_value).replace('{description}', windDirResult.direction)} (${result.wind_direction_score > 0 ? '+' : ''}${result.wind_direction_score} ${pointSuffix})</div>`;
        const suckEffectText = `${getSuckEffectIcon(result.suck_effect_score_value)} ${T.suckEffectLabel} ${result.suck_effect_score_value}/3 (${result.suck_effect_score_value > 0 ? '+' : ''}${result.suck_effect_score_value} ${pointSuffix})`;

        // --- Assemble the card's HTML ---
        let weatherInfoHtml = `
            <h3>${new Date(result.date).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <p class="forecast-label ${forecastClass === 'bad' ? 'bad' : ''}">💨 ${T.forecastLabel} ${finalForecastText}</p>
            <p>${result.scoreText}</p>
            <p>${predictedWindText}</p>
            <h4>${T.detailsLabel}</h4>
            <ul>
                <li>${cloudCoverText}</li>
                <li>${tempDiffText}</li>
                <li>${maxWindText}</li>
                <li>${windDirText}</li>
                <li>${suckEffectText}</li>
            </ul>
        `;
        if (result.waterTemp !== undefined && result.waterTemp !== null) {
            weatherInfoHtml += `<p>${T.waterTempLabel} ${result.waterTemp.toFixed(1)}°C</p>`;
        }
        resultCard.innerHTML = weatherInfoHtml;
        state.resultsContainer.appendChild(resultCard);

        // --- Part 2: Prepare and save raw data for the chart ---
        const historicalEntry = {
            date: result.date,
            finalForecastKey: forecastKey, // Use the unified key
            scoreText: result.scoreText,
            
            // Wind
            pKnots_min: pKnots.min,
            pKnots_max: pKnots.max,
            pMs_min: pMs.min,
            pMs_max: pMs.max,
            avgPredictedKnots: (pKnots.min + pKnots.max) / 2,
            avgPredictedMs: (pMs.min + pMs.max) / 2,

            // Cloud
            cloud_cover_value: result.cloud_cover_value,
            cloud_cover_score: result.cloud_cover_score,

            // Temp
            temp_diff_value: result.temp_diff_value,
            temp_diff_description_key: result.temp_diff_description_key,
            air_temp_value: result.air_temp_value,
            sea_temp_value: result.sea_temp_value,
            temp_diff_score: result.temp_diff_score,

            // API Wind
            wind_speed_value: result.wind_speed_value,
            wind_speed_score: result.wind_speed_score,

            // Wind Dir
            wind_direction_value: result.wind_direction_value,
            wind_direction_description: windDirResult.direction, // Use calculated direction
            wind_direction_score: result.wind_direction_score,

            // Suck Effect
            suck_effect_score_value: result.suck_effect_score_value,
            
            // Water Temp
            waterTemp: result.waterTemp
        };
        await saveHistoricalEntry(historicalEntry);
    }

    await renderHistoricalChart();
}

export function initModal() {
    const modal = document.getElementById('criteria-modal');
    const criteriaLink = document.getElementById('criteria-link');
    const closeButton = document.querySelector('.close-button');

    criteriaLink.onclick = function(event) {
        event.preventDefault();
        modal.style.display = 'block';
    };

    closeButton.onclick = function() {
        modal.style.display = 'none';
    };

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

// --- Function to display the scoring legend ---
function displayScoringLegend(T) {
    const legendContainer = document.getElementById('scoring-legend');
    if (!legendContainer) return;

    const legendHtml = `
        <h4>${T.legendTitle}</h4>
        <p>${T.legendIntro}</p>
        <ul>
            <li>${T.legendCloudCover}</li>
            <li>${T.legendTempDiff}</li>
            <li>${T.legendWindSpeed}</li>
            <li>${T.legendWindDir}</li>
            <li>${T.legendSuckEffect}</li>
        </ul>
    `;

    legendContainer.innerHTML = legendHtml;
}