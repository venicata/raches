import { translations } from './translations.js';
import { state } from './state.js';
import { renderHistoricalChart } from './chart.js';
import { getCloudCoverScore, getTempDiffScore, getWindDirIcon, getSuckEffectIcon } from './scoring-helpers.js';
import { saveHistoricalEntry } from './api.js';

export function setLanguage(lang) {
    if (!translations[lang]) return;
    state.currentLang = lang;
    document.querySelectorAll('[data-lang-key]').forEach(element => {
        const key = element.getAttribute('data-lang-key');
        if (translations[lang][key]) {
            const link = element.querySelector('a');
            if (link) {
                element.innerHTML = translations[lang][key].replace('{link}', link.outerHTML);
            } else {
                element.innerHTML = translations[lang][key];
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
        const historicalEntry = {};
        historicalEntry.date = result.date;
        historicalEntry.forecastLabelText = result.forecastLabel;
        
        const pKnots = result.predicted_wind_knots || { min: 0, max: 0 };
        const pMs = result.predicted_wind_ms || { min: 0, max: 0 };

        const predictedWindKnotsText = `${pKnots.min}-${pKnots.max} ${T.knotsUnit}`;
        const predictedWindMsText = `(${(pMs.min).toFixed(1)}-${(pMs.max).toFixed(1)} ${T.msUnit})`;
        historicalEntry.predictedWindText = `${T.predictedWindLabel} ${predictedWindKnotsText} ${predictedWindMsText}`;

        historicalEntry.avgPredictedKnots = (pKnots.min + pKnots.max) / 2;
        historicalEntry.avgPredictedMs = (pMs.min + pMs.max) / 2;

        const cloudCoverResult = getCloudCoverScore(result.cloud_cover_value);
        historicalEntry.cloudCoverDetailText = `${cloudCoverResult.icon} ${T.cloudCoverLabel} ${result.cloud_cover_value}% (+${result.cloud_cover_score} ${pointSuffix})`;

        const tempDiffResult = getTempDiffScore(result.temp_diff_value);
        const tempDiffDescriptionText = T[result.temp_diff_description_key] || result.temp_diff_description_key;
        const tempDiffValueText = typeof result.temp_diff_value === 'number' ? result.temp_diff_value.toFixed(1) : 'N/A';
        const airTempValueText = typeof result.air_temp_value === 'number' ? result.air_temp_value.toFixed(1) : 'N/A';
        const seaTempValueText = typeof result.sea_temp_value === 'number' ? result.sea_temp_value.toFixed(1) : 'N/A';
        historicalEntry.tempDiffDetailText = `${tempDiffResult.icon} ${T.tempDiffDetail.replace('{description}', tempDiffDescriptionText).replace('{value}', tempDiffValueText).replace('{landTemp}', airTempValueText).replace('{seaTemp}', seaTempValueText)} (+${result.temp_diff_score} ${pointSuffix})`;
        
        const windSpeedValueText = typeof result.wind_speed_value === 'number' ? result.wind_speed_value.toFixed(1) : 'N/A';
        historicalEntry.maxWindSpeedApiDetailText = `${result.wind_speed_icon || '❓'} ${T.apiWindSpeedLabel} ${windSpeedValueText} km/h (+${result.wind_speed_score} ${pointSuffix})`;

        historicalEntry.windDirectionDetailText = `${getWindDirIcon(result.wind_direction_score)} ${T.windDirDetail.replace('{value}', result.wind_direction_value).replace('{description}', result.wind_direction_description)} (+${result.wind_direction_score} ${pointSuffix})`;

        const suckEffectDisplay = `${result.suck_effect_score_value}/3`;
        historicalEntry.suckEffectDetailText = `${getSuckEffectIcon(result.suck_effect_score_value)} ${T.suckEffectLabel} ${suckEffectDisplay} (+${result.suck_effect_score_value} ${pointSuffix})`;
        
        await saveHistoricalEntry(historicalEntry);

        const resultCard = document.createElement('div');
        resultCard.className = 'result-card';
        if (result.finalForecast === T.forecastBad) resultCard.classList.add('not-suitable');

        let weatherInfoHtml = `
            <h3>${new Date(result.date).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <p class="forecast-label ${result.finalForecast === T.forecastBad ? 'bad' : (result.finalForecast === T.forecastHigh ? 'high' : (result.finalForecast === T.forecastMid ? 'mid' : 'low'))}">
                ${T.forecastLabel} ${result.finalForecast}
            </p>
            <p>${result.scoreText}</p>
            <p>${historicalEntry.predictedWindText}</p>
            <h4>${T.detailsLabel}</h4>
            <ul>
                <li>${historicalEntry.cloudCoverDetailText}</li>
                <li>${historicalEntry.tempDiffDetailText}</li>
                <li>${historicalEntry.maxWindSpeedApiDetailText}</li>
                <li>${historicalEntry.windDirectionDetailText}</li>
                <li>${historicalEntry.suckEffectDetailText}</li>
            </ul>
        `;

        if (result.waterTemp !== undefined && result.waterTemp !== null) {
            weatherInfoHtml += `<p>${T.waterTempLabel} ${result.waterTemp.toFixed(1)}°C</p>`;
        }

        resultCard.innerHTML = weatherInfoHtml;
        state.resultsContainer.appendChild(resultCard);
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
