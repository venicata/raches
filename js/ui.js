import { translations } from './translations.js';
import { triggerModelCalculation } from './api.js';
import { state } from './state.js';
import { renderHistoricalChart } from './chart.js';
import { getCloudCoverScore, getTempDiffScore, getWindDirectionScore, getWindDirIcon, getSuckEffectIcon, getPressureDropScore, getHumidityScore, getPrecipitationScore } from './scoring-helpers.js';
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

/**
 * Displays the real wind data by appending it to the corresponding forecast cards.
 * @param {Array} history - An array of historical max wind records.
 */
export function displayRealWindData(history) {
    const T = translations[state.currentLang];

    history.forEach(record => {
        const recordDate = record.timestamp.split('T')[0];
        const resultCard = document.querySelector(`.result-card[data-date='${recordDate}']`);

        if (resultCard) {
            // Проверяваме дали данните вече не са добавени
            if (resultCard.querySelector('.real-wind-data')) {
                return; // Пропускаме, ако вече съществува
            }

            const realWindKnots = record.windSpeedKnots.toFixed(1);
            const realWindGustKnots = record.windGustKnots.toFixed(1);
            const realWindMs = (record.windSpeedKnots * 0.5144).toFixed(1);

            const realWindText = `${T.realWindLabel} <b>${realWindKnots}</b> (пориви до <b>${realWindGustKnots}</b>) ${T.knotsUnit} (${realWindMs} ${T.msUnit})`;
            
            const p = document.createElement('p');
            p.className = 'real-wind-data'; // Клас за идентификация
            p.innerHTML = `🌬️ ${realWindText}`;

            // Добавяме го след прогнозата за вятъра
            const predictedWindElement = resultCard.querySelector('p:nth-of-type(3)');
            if (predictedWindElement) {
                predictedWindElement.insertAdjacentElement('afterend', p);
            } else {
                resultCard.appendChild(p);
            }
        }
    });
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
        resultCard.dataset.date = result.date; // Добавяме атрибут за лесно намиране

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
        const predictedWindText = `${T.predictedWindLabel} <b>${result.predicted_wind_knots}</b> ${T.knotsUnit} (${result.predicted_wind_ms} ${T.msUnit})`;
        const cloudCoverText = `${getCloudCoverScore(result.cloud_cover_value).icon} ${T.cloudCoverLabel} ${result.cloud_cover_value}% (${result.cloud_cover_score > 0 ? '+' : ''}${result.cloud_cover_score} ${pointSuffix})`;
        const tempDiffText = `${getTempDiffScore(result.temp_diff_value).icon} ${T.tempDiffDetail.replace('{description}', result.temp_diff_description).replace('{value}', result.temp_diff_value.toFixed(1)).replace('{landTemp}', result.air_temp_value.toFixed(1)).replace('{seaTemp}', result.sea_temp_value.toFixed(1))} (${result.temp_diff_score > 0 ? '+' : ''}${result.temp_diff_score} ${pointSuffix})`;
        const windSpeedKnots = result.wind_speed_value * 0.539957;
        const windSpeedMs = result.wind_speed_value * 0.277778;
        const maxWindText = `${result.wind_speed_icon || '❓'} ${T.apiWindSpeedLabel} <b>${windSpeedKnots.toFixed(1)}</b> ${T.knotsUnit} (${windSpeedMs.toFixed(1)} ${T.msUnit}) (${result.wind_speed_score > 0 ? '+' : ''}${result.wind_speed_score} ${pointSuffix})`;
        const windDirText = `<div class="wind-direction-container">${getWindDirIcon(result.wind_direction_score)} <span class="wind-arrow" style="transform: rotate(${result.wind_direction_value + 180}deg);"></span> ${T.windDirDetail.replace('{value}', result.wind_direction_value).replace('{description}', result.wind_direction_description)} (${result.wind_direction_score > 0 ? '+' : ''}${result.wind_direction_score} ${pointSuffix})</div>`;
        const suckEffectText = `${getSuckEffectIcon(result.suck_effect_score_value)} ${T.suckEffectLabel} ${result.suck_effect_score_value}/3 (${result.suck_effect_score_value > 0 ? '+' : ''}${result.suck_effect_score_value} ${pointSuffix})`;
        const pressureDropText = `${getPressureDropScore(result.pressure_drop_value).icon} ${T.pressureDropLabel} ${result.pressure_drop_value} hPa (${result.pressure_drop_score > 0 ? '+' : ''}${result.pressure_drop_score} ${pointSuffix})`;
        const humidityText = `${getHumidityScore(result.humidity_value).icon} ${T.humidityLabel} ${result.humidity_value}% (${result.humidity_score > 0 ? '+' : ''}${result.humidity_score} ${pointSuffix})`;
        const precipitationText = `${getPrecipitationScore(result.precipitation_probability_value).icon} ${T.precipitationLabel} ${result.precipitation_probability_value}% (${result.precipitation_probability_score > 0 ? '+' : ''}${result.precipitation_probability_score} ${pointSuffix})`;

        // --- Assemble the card's HTML ---
        let weatherInfoHtml = `
            <h3>${new Date(result.date).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
            <p class="forecast-label ${forecastClass === 'bad' ? 'bad' : ''}">💨 ${T.forecastLabel} ${finalForecastText}</p>
            <p>${result.scoreText}</p>
            <p>${predictedWindText}</p>
            <h4>${T.detailsLabel}</h4>
            <ul>
                <li title="${T.criteria1Title} - ${T.criteria1Desc}">${cloudCoverText}</li>
                <li title="${T.criteria2Title} - ${T.criteria2Desc}">${tempDiffText}</li>
                <li title="${T.criteria3Title} - ${T.criteria3Desc}">${maxWindText}</li>
                <li title="${T.criteria4Title} - ${T.criteria4Desc}">${windDirText}</li>
                <li title="${T.criteria5Title} - ${T.criteria5Desc}">${suckEffectText}</li>
                <li title="${T.criteria6Title} - ${T.criteria6Desc}">${pressureDropText}</li>
                <li title="${T.criteria7Title} - ${T.criteria7Desc}">${humidityText}</li>
                <li title="${T.criteria8Title} - ${T.criteria8Desc}">${precipitationText}</li>
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
            pKnots_min: result.pKnots_min,
            pKnots_max: result.pKnots_max,
            pMs_min: result.pKnots_min * 0.514444,
            pMs_max: result.pKnots_max * 0.514444,
            avgPredictedKnots: result.avgPredictedKnots, // Corrected prediction
            rawAvgPredictedKnots: result.rawAvgPredictedKnots, // Raw prediction

            // Cloud
            cloud_cover_value: result.cloud_cover_value,
            cloud_cover_score: result.cloud_cover_score,

            // Temp
            temp_diff_value: result.temp_diff_value,
            temp_diff_description: result.temp_diff_description,
            air_temp_value: result.air_temp_value,
            sea_temp_value: result.sea_temp_value,
            temp_diff_score: result.temp_diff_score,

            // API Wind
            wind_speed_value: result.wind_speed_value,
            wind_speed_score: result.wind_speed_score,

            // Wind Dir
            wind_direction_value: result.wind_direction_value,
            wind_direction_description: result.wind_direction_description,
            wind_direction_score: result.wind_direction_score,

            // Suck Effect
            suck_effect_score_value: result.suck_effect_score_value,

            // New Params (ensuring they are numbers)
            pressure_drop_value: parseFloat(result.pressure_drop_value),
            pressure_drop_score: parseFloat(result.pressure_drop_score),
            humidity_value: parseFloat(result.humidity_value),
            humidity_score: parseFloat(result.humidity_score),
            precipitation_probability_value: parseFloat(result.precipitation_probability_value),
            precipitation_probability_score: parseFloat(result.precipitation_probability_score),
            
            // Water Temp
            waterTemp: result.waterTemp
        };
        await saveHistoricalEntry(historicalEntry);
    }

    await renderHistoricalChart();
}

export function initRecalibrateButton() {
    const btn = document.getElementById('recalibrateModelBtn');
    const statusEl = document.getElementById('recalibrateStatus');

    if (!btn || !statusEl) return;

    btn.addEventListener('click', async () => {
        btn.disabled = true;
        statusEl.textContent = 'Изчисляване...';
        statusEl.style.color = '#555';

        try {
            const result = await triggerModelCalculation();
            statusEl.textContent = result.message || 'Готово!';
            statusEl.style.color = 'green';
            // Optionally, refresh the chart or data
            // await fetchAndAnalyze(state.startDate, state.endDate);
        } catch (error) {
            statusEl.textContent = `Грешка: ${error.message}`;
            statusEl.style.color = 'red';
        } finally {
            btn.disabled = false;
        }
    });
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
            <li>${T.legendPressureDrop}</li>
            <li>${T.legendHumidity}</li>
            <li>${T.legendPrecipitation}</li>
        </ul>
    `;

    legendContainer.innerHTML = legendHtml;
}