import { translations } from './translations.js';
import { triggerModelCalculation } from './api.js';
import { state } from './state.js';
import { renderHistoricalChart, renderRealWindChart } from './chart.js';
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
    const realWindChartTitleEl = document.getElementById('realWindChartTitleKey');
    if (realWindChartTitleEl) {
        realWindChartTitleEl.textContent = translations[state.currentLang].realWindChartTitleKey;
    }

    if (state.historicalChartInstance) {
        renderHistoricalChart();
    }
    if (state.realWindChartInstance) {
        renderRealWindChart();
    }
}

/**
 * Displays the predicted peak wind time.
 * @param {string} predictedTime - The predicted time string (e.g., "14:30").
 */
export function displayPeakWindPrediction(predictedTime) {
    const container = document.getElementById('peak-wind-prediction-container');
    if (container) {
        const T = translations[state.currentLang];
        container.innerHTML = `<span>${T.peakTimePrediction || 'Predicted peak wind at'}:</span> <strong>~${predictedTime}</strong>`;
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

            let realWindText = `${T.realWindLabel} <b>${realWindKnots}</b> (пориви до <b>${realWindGustKnots}</b>) ${T.knotsUnit} (${realWindMs} ${T.msUnit})`;

            // Проверка и добавяне на средната скорост около пика
            if (record.avgWindSpeedAroundPeak) {
                const avgWindKnots = record.avgWindSpeedAroundPeak.toFixed(1);
                realWindText += ` | ${T.avgWindAroundPeakLabel} <b>${avgWindKnots}</b> ${T.knotsUnit}`;
            }

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

export async function displayResults(analysisResults, maxWindHistory, peakWindModel, correctionModel) {
    if (!analysisResults || analysisResults.length === 0) {
        state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderDefault}</p>`;
        const chartSection = document.getElementById('chartSection');
        if (chartSection) chartSection.style.display = 'none';
        return;
    }

    // Create a map for quick lookup of real peak wind times
    const realPeakWindTimes = {};
    if (maxWindHistory) {
        maxWindHistory.forEach(record => {
            const date = record.timestamp.split('T')[0];
            realPeakWindTimes[date] = record.timestamp;
        });
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
        const forecastDate = result.date;
        let peakTimeText = '';

        if (realPeakWindTimes[forecastDate]) {
            // Real peak wind time exists for this day
            const peakTimestamp = new Date(realPeakWindTimes[forecastDate]);
            const formattedPeakTime = peakTimestamp.toLocaleTimeString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
            peakTimeText = ` - ${T.peakLabel}: ${formattedPeakTime}`; // No tilde, as it's a real value
        } else if (peakWindModel && peakWindModel.monthly_avg_peak_hour) {
            // Fallback to predicted peak wind time
            const month = new Date(forecastDate).getUTCMonth() + 1;
            const averageHour = peakWindModel.monthly_avg_peak_hour[month];
            if (averageHour) {
                const hour = Math.floor(averageHour);
                const minutes = Math.round((averageHour - hour) * 60);
                const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
                const predictedPeakTime = `${hour}:${formattedMinutes}`;
                peakTimeText = ` - ${T.peakTimePrediction || 'Пик'}: ~${predictedPeakTime}`;
            }
        }

        const predictedWindText = `${T.predictedWindLabel} <b>${result.predicted_wind_knots}</b> ${T.knotsUnit} (${result.predicted_wind_ms} ${T.msUnit})${peakTimeText}`;
        const cloudCoverText = `${getCloudCoverScore(result.cloud_cover_value).icon} ${T.cloudCoverLabel} ${result.cloud_cover_value}% (${result.cloud_cover_score > 0 ? '+' : ''}${result.cloud_cover_score} ${pointSuffix})`;
        const tempDiffText = `${getTempDiffScore(result.temp_diff_value).icon} ${T.tempDiffDetail.replace('{description}', result.temp_diff_description).replace('{value}', result.temp_diff_value.toFixed(1)).replace('{landTemp}', result.air_temp_value.toFixed(1)).replace('{seaTemp}', result.sea_temp_value.toFixed(1))} (${result.temp_diff_score > 0 ? '+' : ''}${result.temp_diff_score} ${pointSuffix})`;
        const windSpeedKnots = result.wind_speed_value * 0.539957;
        const windSpeedMs = result.wind_speed_value * 0.277778;
        const maxWindText = `${result.wind_speed_icon || '❓'} ${T.apiWindSpeedLabel} <b>${windSpeedKnots.toFixed(1)}</b> ${T.knotsUnit} (${windSpeedMs.toFixed(1)} ${T.msUnit}) (${result.wind_speed_score > 0 ? '+' : ''}${result.wind_speed_score} ${pointSuffix})`;
        const windDirText = `<span class="wind-direction-container">${getWindDirIcon(result.wind_direction_score)} <span class="wind-arrow" style="transform: rotate(${result.wind_direction_value + 180}deg);"></span> <span>${T.windDirDetail.replace('{value}', result.wind_direction_value).replace('{description}', result.wind_direction_description)} (${result.wind_direction_score > 0 ? '+' : ''}${result.wind_direction_score} ${pointSuffix})</span></span>`;
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
            <p class="baseline-correction">${T.baselineLabel}: ${result.baselineAvgKnots.toFixed(1)} ${T.knotsUnit}, ${T.correctionLabel}: ${result.correction.toFixed(1)} ${T.knotsUnit}</p>
            <h4>${T.detailsLabel}</h4>
            <ul>
                <li>
                    <span class="li-content">${cloudCoverText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria1Title}</strong><br>${T.criteria1Desc}</div>
                </li>
                <li>
                    <span class="li-content">${tempDiffText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria2Title}</strong><br>${T.criteria2Desc}</div>
                </li>
                <li>
                    <span class="li-content">${maxWindText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria3Title}</strong><br>${T.criteria3Desc}</div>
                </li>
                <li>
                    <span class="li-content">${windDirText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria4Title}</strong><br>${T.criteria4Desc}</div>
                </li>
                <li>
                    <span class="li-content">${suckEffectText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria5Title}</strong><br>${T.criteria5Desc}</div>
                </li>
                <li>
                    <span class="li-content">${pressureDropText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria6Title}</strong><br>${T.criteria6Desc}</div>
                </li>
                <li>
                    <span class="li-content">${humidityText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria7Title}</strong><br>${T.criteria7Desc}</div>
                </li>
                <li>
                    <span class="li-content">${precipitationText}</span>
                    <i class="info-icon">i</i>
                    <div class="custom-tooltip"><strong>${T.criteria8Title}</strong><br>${T.criteria8Desc}</div>
                </li>
            </ul>
        `;
        if (result.waterTemp !== undefined && result.waterTemp !== null) {
            weatherInfoHtml += `<p>${T.waterTempLabel} ${result.waterTemp.toFixed(1)}°C</p>`;
        }
        resultCard.innerHTML = weatherInfoHtml;
        state.resultsContainer.appendChild(resultCard);

        // --- Part 1.5: Add event listeners for custom tooltips ---
        resultCard.querySelectorAll('ul li').forEach(li => {
            li.addEventListener('click', (e) => {
                e.stopPropagation(); // Prevent click from bubbling to the document
                // Hide all other tooltips
                document.querySelectorAll('.result-card ul li.show-tooltip').forEach(item => {
                    if (item !== li) {
                        item.classList.remove('show-tooltip');
                    }
                });
                // Toggle current tooltip
                li.classList.toggle('show-tooltip');
            });
        });

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
            avgPredictedMs: result.avgPredictedMs,
            rawAvgPredictedMs: result.rawAvgPredictedMs,

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

    // Display real wind data on the cards if available
    if (maxWindHistory) {
        displayRealWindData(maxWindHistory);
    }

    // Display the correction model if available
    displayCorrectionModel(correctionModel);
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

export function displayCorrectionModel(model) {
    const container = document.getElementById('correction-model-container');
    const paramsEl = document.getElementById('correction-model-params');

    if (model && model.coefficients && container && paramsEl) {
        // Format for display
        const displayModel = {
            lastUpdated: model.lastUpdated,
            recordsAnalyzed: model.recordsAnalyzed,
            coefficients: model.coefficients
        };

        paramsEl.textContent = JSON.stringify(displayModel, null, 2);
        container.style.display = 'block';
    } else if (container) {
        container.style.display = 'none';
    }
}

export function initModal() {
    const modal = document.getElementById('criteria-modal');
    const criteriaLink = document.getElementById('criteria-link');
    const closeButton = document.querySelector('.close-button');

    criteriaLink.onclick = function (event) {
        event.preventDefault();
        modal.style.display = 'block';
    };

    closeButton.onclick = function () {
        modal.style.display = 'none';
    };

    window.onclick = function (event) {
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