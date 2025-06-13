const KNOTS_TO_MS = 0.514444; // Define globally

let historicalChartInstance = null; // Make it globally accessible
const HISTORICAL_DATA_KEY = 'rachesForecastHistoryV2';

document.addEventListener('DOMContentLoaded', () => {
    // Координати за Рахес
    const RACHES_LAT = 38.867085;
    const RACHES_LON = 22.759371;

    const VOLOS_LAT = 38.9534;
    const VOLOS_LON = 22.9668;

    // --- START: Language and Translations ---
    let currentLang = 'bg';

    const translations = {
        en: {
            title: "💨 Raches Thermal Wind Forecaster",
            subtitle: "AI Assistant for thermal wind forecast in Raches",
            instructions: "Double-click a date for a single day, or select a date range",
            analyzeBtn: "Analyze",
            placeholderLoading: "Loading data and analyzing... ",
            placeholderDefault: "Select a period and click 'Analyze' to see the forecast.",
            forecastHigh: "HIGH PROBABILITY OF GOOD CONDITIONS",
            forecastMid: "MEDIUM PROBABILITY OF GOOD CONDITIONS",
            forecastBad: "LOW PROBABILITY / BAD CONDITIONS",
            forecastNotSuitableKiting: "UNSUITABLE FOR KITING (Wind too low)",
            forecastLabel: " Forecast:",
            scoreLabel: " <b>Score: {score}</b> (from {minScore} to {maxScore})",
            predictedWindLabel: "Predicted Wind:",
            waterTempLabel: "Water Temperature:",
            historicalChartTitleKey: "Historical Wind Overview",
            knotsUnit: "knots",
            msUnit: "m/s",
            suckEffectStrengthLabel: "Suck Effect Strength:",
            apiWindSpeedLabel: "Max Wind Speed (API):",
            cloudCoverLabel: "Cloud Cover:",
            airTempLabel: "Air Temperature:",
            windDirLabel: "Wind Direction:",
            suckEffectLabel: "Suck Effect:",
            detailsLabel: "Details:",
            cloudCoverDetail: "Cloud Cover: {value}%",
            tempDiffDetail: "Temp Difference (Land-Sea): {description} ({value}°C) (Land: {landTemp}°C, Sea: {seaTemp}°C)",
            windSpeedDetail: "Max Wind Speed: {value} km/h",
            windDirDetail: "Wind Direction: {value}° ({description})", // Generic wind direction detail
            windDirOnshore: "Suitable - Onshore",
            windDirOffshore: "Unsuitable - Offshore",
            windDirSideShore: "Side-shore",
            windDirOffshoreBad: "Unsuitable - Directly Offshore (Bad)",
            windDirSideOff: "Side-Offshore (Not Ideal)",
            suckEffectDetail: "Suck Effect (Thermal Wind): {value}/3",
            knotsUnit: "knots",
            msUnit: "m/s",
            noData: "N/A",
            mapLink: " Map",
            criteriaLink: " Criteria",
            footerText: "Created with AI assistant. Data from <a href=\"https://open-meteo.com/\" target=\"_blank\">Open-Meteo</a>.",
            modalTitle: "Criteria for Thermal Wind in Raches",
            modalIntro: "In Raches, the thermal effect intensifies when the following 5 conditions are met simultaneously:",
            criteria1Title: " 1. Sunny and clear sky (no clouds until noon)",
            criteria1Desc: " Windy: enable Clouds layer → look for very few clouds before 13:00. Why? The sun needs to heat the land to create a temperature difference between land and sea.",
            criteria2Title: " 2. Land-sea temperature difference",
            criteria2Desc: " Windy: enable Airgram or Meteogram layer. Look for: Air temperature on land (e.g., 30°C). Sea temperature (usually 23–25°C). The greater the difference, the stronger the thermal breeze.",
            criteria3Title: " 3. Weak to moderate synoptic circulation from east or northeast (ENE/NE)",
            criteria3Desc: " Windy: enable Wind layer → observe the arrows in the Raches area. The ideal scenario is 5–10 knots from ENE/NE in the morning (until noon). This \"helps\" the thermal effect without suppressing it.",
            criteria4Title: " 4. No strong west or south wind",
            criteria4Desc: " It's important to have no wind against the thermal effect. Wind from W, SW, S will kill or reverse it. Avoid days with a forecast for west wind after 15:00.",
            criteria5Title: " 5. Local suction effect (you can ‘see’ it in Windy by wind acceleration around 14–16h)",
            criteria5Desc: " Windy: in the Wind layer, place the cursor on the spot (Raches). If the wind sharply increases after 13:00 (e.g., from 6 to 15 knots), this is THERMAL INTENSIFICATION.",
            pointsSuffix: "pts",
            tempDiffHigh: "High",
            tempDiffMedium: "Medium",
            tempDiffLow: "Low",
            tempDiffVeryLow: "Very Low"
        },
        bg: {
            title: " Raches Thermal Wind Forecaster",
            subtitle: "AI Асистент за прогноза на термичния вятър в Рахес",
            instructions: "Кликнете 2 пъти на една дата, или селектирайте период от дати",
            analyzeBtn: "Анализирай",
            placeholderLoading: "Зареждам данни и анализирам... ",
            placeholderDefault: "Изберете период и натиснете 'Анализирай', за да видите прогнозата.",
            forecastHigh: "ВИСОКА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ",
            forecastMid: "СРЕДНА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ",
            forecastBad: "НИСКА ВЕРОЯТНОСТ / ЛОШИ УСЛОВИЯ",
            forecastNotSuitableKiting: "НЕ Е ПОДХОДЯЩО ЗА КАЙТ (Слаб вятър)",
            forecastLabel: " Прогноза:",
            scoreLabel: " <b>Оценка: {score}</b> (от {minScore} до {maxScore})",
            predictedWindLabel: "Прогнозиран вятър:",
            waterTempLabel: "Температура на водата:",
            historicalChartTitleKey: "Исторически Преглед на Вятъра",
            knotsUnit: "възли",
            msUnit: "м/с",
            suckEffectStrengthLabel: "Сила на Suck ефекта:",
            apiWindSpeedLabel: "Макс. скорост на вятър (API):",
            cloudCoverLabel: "Облачност:",
            airTempLabel: "Температура на въздуха:",
            windDirLabel: "Посока на вятър:",
            suckEffectLabel: "Suck ефект:",
            detailsLabel: "Детайли:",
            cloudCoverDetail: "Облачност: {value}%",
            tempDiffDetail: "Температурна разлика (суша-море): {description} ({value}°C) (Суша: {landTemp}°C, Море: {seaTemp}°C)",
            windSpeedDetail: "Макс. скорост на вятър: {value} km/h",
            windDirDetail: "Посока на вятър: {value}° ({description})", // Общ ключ за посока на вятъра
            windDirOnshore: "Подходяща - Onshore",
            windDirOffshore: "Неподходяща - Offshore",
            windDirSideShore: "Странична - Side-shore",
            windDirOffshoreBad: "Неподходяща - Директно Offshore (Лоша)",
            windDirSideOff: "Странично-Offshore (Не идеална)",
            windDirE_SE: "Източен, Югоизточен (Идеална)",
            windDirS_SSE: "Южен, Юго-югоизточен (Приемлива)",
            windDirN_NE: "Северен, Североизточен (Приемлива)",
            windDirS_SSW: "Южен, Юго-югозападен (Неутрална)",
            windDirW_SW_NW: "Западен, Югозападен, Северозападен (Лоша)",
            suckEffectDetail: "Suck ефект (термичен вятър): {value}/3",
            knotsUnit: "възли",
            msUnit: "м/с",
            noData: "N/A",
            mapLink: "📍 Карта",
            criteriaLink: "📋 Критерии",
            footerText: "Създадено с AI асистент. Данни от <a href=\"https://open-meteo.com/\" target=\"_blank\">Open-Meteo</a>.",
            modalTitle: "Критерии за Термичен Вятър в Рахес",
            modalIntro: "В Рахес термиката се засилва, когато са налице следните 5 условия едновременно:",
            criteria1Title: "✅ 1. Слънчево и ясно небе (без облаци до обяд)",
            criteria1Desc: "➡️ Windy: включи слоя Clouds → търси много малко облаци преди 13:00. Защо? Слънцето трябва да затопли сушата, за да се създаде температурна разлика между суша и море.",
            criteria2Title: "✅ 2. Температурна разлика суша-море",
            criteria2Desc: "➡️ Windy: включи слоя Airgram или Meteogram. Търси: Температура на въздуха на сушата (примерно 30°C). Температура на морето (обикновено 23–25°C). Колкото по-голяма е разликата, толкова по-силен е термичният бриз.",
            criteria3Title: "✅ 3. Слаба до умерена синоптична циркулация от изток или североизток (ENE/NE)",
            criteria3Desc: "➡️ Windy: включи слоя Wind → наблюдавай стрелките в района на Raches. Идеалният сценарий е 5–10 възела от ENE/NE сутринта (до обяд). Това \"помага\" на термиката, без да я задушава.",
            criteria4Title: "✅ 4. Без силен западен или южен вятър",
            criteria4Desc: "➡️ Важно е да няма вятър срещу термиката. Вятър от W, SW, S ще я убие или обърне. Избягвай дни с прогноза за западен вятър след 15:00.",
            criteria5Title: "✅ 5. Местен ефект на засмукване (можеш да го „видиш“ в Windy по ускоряване на вятъра около 14–16 ч.)",
            criteria5Desc: "➡️ Windy: в слоя Wind, постави курсора на мястото на спота (Raches). Ако след 13:00 вятърът рязко се усилва (примерно от 6 до 15 възела), това е ТЕРМИЧНО ЗАСИЛВАНЕ.",
            pointsSuffix: "т.",
            tempDiffHigh: "Висока",
            tempDiffMedium: "Средна",
            tempDiffLow: "Ниска",
            tempDiffVeryLow: "Много ниска"
        }
    };

    const setLanguage = (lang) => {
        if (!translations[lang]) return;
        currentLang = lang;
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            if (translations[lang][key]) {
                // Preserve child elements like links if they exist
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
        
        const resultsContainer = document.getElementById('results-container'); // Ensure resultsContainer is defined here
        if (resultsContainer && resultsContainer.querySelector('.placeholder')) {
             resultsContainer.innerHTML = `<p class="placeholder">${translations[currentLang].placeholderDefault}</p>`;
        }

        // Update chart with new language
        const chartTitleEl = document.getElementById('historicalChartTitleKey');
        if (chartTitleEl) {
            chartTitleEl.textContent = translations[currentLang].historicalChartTitleKey;
        }
        if (historicalChartInstance) { 
            renderHistoricalChart();
        }
    };

    document.getElementById('lang-bg').addEventListener('click', () => setLanguage('bg'));
    document.getElementById('lang-en').addEventListener('click', () => setLanguage('en'));
    // --- END: Language and Translations ---


    // Инициализация на календара
    const datePicker = flatpickr("#date-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
        minDate: "today",
        maxDate: new Date().fp_incr(15) // Позволява прогноза до 16 дни напред
    });

    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsContainer = document.getElementById('results-container');
    
    resultsContainer.innerHTML = `<p class="placeholder">${translations[currentLang].placeholderDefault}</p>`;

    analyzeBtn.addEventListener('click', () => {
        const selectedDates = datePicker.selectedDates;
        if (selectedDates.length < 2) {
            if (selectedDates.length === 1) {
                datePicker.setDate([selectedDates[0], selectedDates[0]], true);
            } else {
                alert("Моля, изберете период от дати.");
                return;
            }
        }
        
        const startDate = formatDate(datePicker.selectedDates[0]);
        const endDate = formatDate(datePicker.selectedDates[1]);
        
        fetchAndAnalyze(startDate, endDate);
    });

    function formatDate(date) {
        const d = new Date(date),
              year = d.getFullYear(),
              month = ('0' + (d.getMonth() + 1)).slice(-2),
              day = ('0' + d.getDate()).slice(-2);
        return [year, month, day].join('-');
    }

    async function fetchAndAnalyze(startDate, endDate) {
        resultsContainer.innerHTML = `<p class="placeholder">${translations[currentLang].placeholderLoading}</p>`;
        
        const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RACHES_LAT}&longitude=${RACHES_LON}&hourly=temperature_2m,cloudcover,windspeed_10m,winddirection_10m&daily=cloud_cover_mean,temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
        const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${VOLOS_LAT}&longitude=${VOLOS_LON}&hourly=sea_surface_temperature&start_date=${startDate}&end_date=${endDate}&timezone=auto`;

        try {
            const [weatherResponse, marineResponse] = await Promise.all([
                fetch(weatherApiUrl),
                fetch(marineApiUrl)
            ]);

            if (!weatherResponse.ok || !marineResponse.ok) {
                throw new Error('Проблем при връзката с API-то за времето.');
            }
            
            const weatherData = await weatherResponse.json();
            const marineData = await marineResponse.json();

            const analysisResults = await processWeatherData(weatherData, marineData);
            displayResults(analysisResults);
        } catch (error) {
            resultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Грешка: ${error.message}</p>`;
        }
    }

    // Helper icon functions (simplified)
    function getWindDirIcon(score) { // Based on windDirectionScore logic
        if (score >= 1) return '✅';
        if (score === 0) return '⚠️'; // Neutral or warning for 0 score
        return '❌';
    }
    function getSuckEffectIcon(score) {
        if (score >= 2) return '✅';
        if (score === 1) return '⚠️';
        return '❌';
    }

    // Helper functions for granular scoring (re-implemented and detailed)
    function getCloudCoverScore(cloudCover) {
        if (cloudCover <= 5) return { score: 5, icon: '✅' };    // Max positive score +5
        if (cloudCover <= 10) return { score: 4.5, icon: '✅' };
        if (cloudCover <= 15) return { score: 4, icon: '✅' };
        if (cloudCover <= 20) return { score: 3.5, icon: '✅' };
        if (cloudCover <= 30) return { score: 3, icon: '✅' }; 
        if (cloudCover <= 40) return { score: 2, icon: '⚠️' };
        if (cloudCover <= 50) return { score: 1, icon: '⚠️' };
        if (cloudCover <= 60) return { score: 0, icon: '⚠️' }; 
        if (cloudCover <= 70) return { score: -1, icon: '❌' };
        if (cloudCover <= 80) return { score: -1.5, icon: '❌' };
        if (cloudCover <= 90) return { score: -2, icon: '❌' };
        return { score: -3, icon: '❌' }; // 91-100%, min negative score -3
    }

    function getTempDiffScore(tempDiff) {
        if (tempDiff >= 8) return { score: 5.25, icon: '✅', textKey: 'tempDiffHigh' };    // 3.5 * 1.5
        if (tempDiff >= 7) return { score: 4.5, icon: '✅', textKey: 'tempDiffHigh' };     // 3 * 1.5
        if (tempDiff >= 6) return { score: 3.75, icon: '✅', textKey: 'tempDiffHigh' };   // 2.5 * 1.5
        if (tempDiff >= 5) return { score: 3, icon: '✅', textKey: 'tempDiffHigh' };       // 2 * 1.5
        if (tempDiff >= 4) return { score: 2.25, icon: '⚠️', textKey: 'tempDiffMedium' }; // 1.5 * 1.5
        if (tempDiff >= 3) return { score: 1.5, icon: '⚠️', textKey: 'tempDiffMedium' };  // 1 * 1.5
        if (tempDiff >= 2) return { score: 0.75, icon: '⚠️', textKey: 'tempDiffLow' };    // 0.5 * 1.5
        if (tempDiff >= 1) return { score: 0, icon: '❌', textKey: 'tempDiffLow' };        // 0 * 1.5 remains 0
        return { score: -1.5, icon: '❌', textKey: 'tempDiffVeryLow' }; // -1 * 1.5
    }

async function processWeatherData(weatherData, marineData) {
    const dailyData = {};
    weatherData.daily.time.forEach((date, index) => {
        dailyData[date] = {
            cloud_cover: weatherData.daily.cloud_cover_mean[index],
            temperature_2m_max: weatherData.daily.temperature_2m_max[index],
            wind_speed_10m_max: weatherData.daily.wind_speed_10m_max[index],
            wind_direction_10m_dominant: weatherData.daily.wind_direction_10m_dominant[index],
            sea_temp: undefined, // Will be filled or estimated
            // Scores and detailed values will be added below
        };
    });

    // Fill in sea temperatures from marine data if available
    if (marineData && marineData.hourly && marineData.hourly.time && marineData.hourly.sea_surface_temperature) {
        marineData.hourly.time.forEach((datetime, index) => {
            const date = datetime.split('T')[0];
            const hour = parseInt(datetime.split('T')[1].split(':')[0]);
            if (hour === 13 && dailyData[date]) { // Use 1 PM sea temperature
                dailyData[date].sea_temp = marineData.hourly.sea_surface_temperature[index];
            }
        });
    }

    // Estimate missing sea temperatures
    let lastKnownSeaTemp = null;
    // First pass to find any known sea temperature
    for (const date of weatherData.daily.time) {
        if (dailyData[date] && dailyData[date].sea_temp !== undefined && dailyData[date].sea_temp !== null) {
            lastKnownSeaTemp = dailyData[date].sea_temp;
            break; // Found one, use it as a starting point
        }
    }
    if (lastKnownSeaTemp === null) lastKnownSeaTemp = 15.0; // Default if no marine data at all

    // Second pass to fill missing ones
    for (const date of weatherData.daily.time) {
        if (dailyData[date]) {
            if (dailyData[date].sea_temp !== undefined && dailyData[date].sea_temp !== null) {
                lastKnownSeaTemp = dailyData[date].sea_temp; // Update if a new known value is found
            } else {
                dailyData[date].sea_temp = lastKnownSeaTemp; // Fill with the last known
            }
        }
    }

    const analysisResults = [];
    const T = translations[currentLang]; // Get translations once

    for (const date in dailyData) {
        const data = dailyData[date]; // This is the object for the current day
        let score = 0;

        // Suck Effect Score
        let suckEffectScore = 0;
        let morningWindSpeed = null;
        let afternoonWindSpeed = null;
        if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.windspeed_10m) {
            const hourlyTimes = weatherData.hourly.time;
            const hourlyWindSpeeds = weatherData.hourly.windspeed_10m;
            for (let i = 0; i < hourlyTimes.length; i++) {
                const hourlyDateTime = hourlyTimes[i];
                const entryDate = hourlyDateTime.split('T')[0];
                const entryHour = parseInt(hourlyDateTime.split('T')[1].split(':')[0]);
                if (entryDate === date) {
                    if (entryHour >= 9 && entryHour <= 11) { // Morning window 9-11 AM
                        if (morningWindSpeed === null || hourlyWindSpeeds[i] > morningWindSpeed) {
                            morningWindSpeed = hourlyWindSpeeds[i];
                        }
                    }
                    if (entryHour >= 15 && entryHour <= 17) { // Afternoon window 3-5 PM
                        if (afternoonWindSpeed === null || hourlyWindSpeeds[i] > afternoonWindSpeed) {
                            afternoonWindSpeed = hourlyWindSpeeds[i];
                        }
                    }
                }
            }
        }
        if (morningWindSpeed !== null && afternoonWindSpeed !== null) {
            const windIncreaseKmh = afternoonWindSpeed - morningWindSpeed;
            if (windIncreaseKmh >= 15) { suckEffectScore = 3; }
            else if (windIncreaseKmh >= 10) { suckEffectScore = 2; }
            else if (windIncreaseKmh >= 5) { suckEffectScore = 1; }
        }
        score += suckEffectScore;
        data.suck_effect_score_value = suckEffectScore;

        // 1. Cloud Cover
        const cloudCoverResult = getCloudCoverScore(data.cloud_cover); // data.cloud_cover is mean cloud cover
        score += cloudCoverResult.score;
        data.cloud_cover_score = cloudCoverResult.score;
        data.cloud_cover_value = data.cloud_cover;

        // 2. Temperature Difference (Land - Sea)
        data.air_temp_value = data.temperature_2m_max;
        data.sea_temp_value = data.sea_temp; // Already populated or estimated
        const tempDiff = data.air_temp_value - data.sea_temp_value;
        data.temp_diff_value = tempDiff;
        const tempDiffResult = getTempDiffScore(tempDiff);
        score += tempDiffResult.score;
        data.temp_diff_score = tempDiffResult.score;
        data.temp_diff_description_key = tempDiffResult.textKey;

        // 3. Wind Speed (from API) - Max daily wind speed
        data.wind_speed_value = data.wind_speed_10m_max;
        let windSpeedScore = 0;
        let windSpeedIcon = '';
        if (data.wind_speed_value >= 15 && data.wind_speed_value <= 30) { windSpeedScore = 2; windSpeedIcon = '✅'; }
        else if (data.wind_speed_value > 30 && data.wind_speed_value <= 40) { windSpeedScore = 1; windSpeedIcon = '⚠️'; }
        else if (data.wind_speed_value < 15 && data.wind_speed_value >= 5) { windSpeedScore = 0; windSpeedIcon = '❌'; } // Neutral/Low
        else if (data.wind_speed_value < 5) { windSpeedScore = -1; windSpeedIcon = '❌'; } // Too low
        else { windSpeedScore = -2; windSpeedIcon = '❌'; } // Too high (over 40)
        score += windSpeedScore;
        data.wind_speed_score = windSpeedScore;
        data.wind_speed_icon = windSpeedIcon;

        // 4. Wind Direction - Dominant daily wind direction
        data.wind_direction_value = data.wind_direction_10m_dominant;
        let windDirectionScore = 0;
        let windDirDescKey = '';
        const dir = data.wind_direction_value;
        if ((dir >= 45 && dir <= 135)) { // E, SE (Ideal)
            windDirectionScore = 2; windDirDescKey = 'windDirE_SE';
        } else if ((dir > 135 && dir <= 170) || (dir >= 0 && dir < 45)) { // S-SSE, N-NE (Acceptable)
            windDirectionScore = 1; windDirDescKey = (dir > 135 && dir <= 170) ? 'windDirS_SSE' : 'windDirN_NE';
        } else if (dir > 170 && dir < 225) { // S, SSW (Neutral, can be tricky)
            windDirectionScore = 0; windDirDescKey = 'windDirS_SSW';
        } else { // W, SW, NW (Bad)
            windDirectionScore = -2; windDirDescKey = 'windDirW_SW_NW';
        }
        score += windDirectionScore;
        data.wind_direction_score = windDirectionScore;
        data.wind_direction_description = T[windDirDescKey] || windDirDescKey; // Store translated description

        // Final Score and Forecast Label
        data.score = score;
        const minScoreTotal = -8.5; // Cloud(-3) + TempDiff(-1.5) + WindSpeed(-2) + WindDir(-2) + Suck(0) = -8.5
        const maxScoreTotal = 17.25; // Cloud(5) + TempDiff(5.25) + WindSpeed(2) + WindDir(2) + Suck(3) = 17.25
        data.scoreText = T.scoreLabel.replace('{score}', score).replace('{minScore}', minScoreTotal).replace('{maxScore}', maxScoreTotal);

        if (score >= 11) { data.forecastLabel = T.forecastHigh; }
        else if (score >= 7) { data.forecastLabel = T.forecastMid; }
        else if (score >= 2.5) { data.forecastLabel = T.forecastLow; }
        else { data.forecastLabel = T.forecastBad; }

        // Predict Wind Speed Range
        const predictedWindText = predictWindSpeedRange(data.wind_speed_10m_max, score, suckEffectScore, data.wind_direction_10m_dominant);
        const parsedWind = parsePredictedWindRange(predictedWindText, T); // Use the new helper
        data.predicted_wind_knots = parsedWind.knots;
        data.predicted_wind_ms = parsedWind.ms;

        // Override forecast label if predicted wind is too low for kiting
        const KITING_MIN_KNOTS = 16;
        console.log(`Kiting Wind Check: Max Predicted Knots: ${data.predicted_wind_knots ? data.predicted_wind_knots.max : 'N/A'}, Threshold: ${KITING_MIN_KNOTS}`);
        if (data.predicted_wind_knots && data.predicted_wind_knots.max > 0 && data.predicted_wind_knots.max < KITING_MIN_KNOTS) { // Check max > 0 to avoid overriding N/A cases incorrectly
            data.forecastLabel = T.forecastNotSuitableKiting;
        }

        // Push all data needed by displayResults
        analysisResults.push({
            date: date,
            score: data.score,
            scoreText: data.scoreText,
            finalForecast: data.forecastLabel, 
            forecastLabel: data.forecastLabel, 

            cloud_cover_value: data.cloud_cover_value,
            cloud_cover_score: data.cloud_cover_score,
            
            temp_diff_value: data.temp_diff_value,
            temp_diff_score: data.temp_diff_score,
            temp_diff_description_key: data.temp_diff_description_key,
            air_temp_value: data.air_temp_value,
            sea_temp_value: data.sea_temp_value,
            
            wind_speed_value: data.wind_speed_value,
            wind_speed_score: data.wind_speed_score,
            wind_speed_icon: data.wind_speed_icon,
            
            wind_direction_value: data.wind_direction_value,
            wind_direction_score: data.wind_direction_score,
            wind_direction_description: data.wind_direction_description,
            
            suck_effect_score_value: data.suck_effect_score_value,
            
            predicted_wind_knots: data.predicted_wind_knots, 
            predicted_wind_ms: data.predicted_wind_ms,     
            
            waterTemp: data.sea_temp_value 
        });
    }
    return analysisResults;
}

// Helper function to parse predicted wind range string
function parsePredictedWindRange(rangeString, T_unused) { // T might not be needed if not using translations here
    // Example input: "10-15 възли (5.1-7.7 м/с)" or "0-0 knots (0.0-0.0 m/s)"
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

    function predictWindSpeedRange(baseWindSpeedKmH, overallScore, suckEffectScore, windDirection) {
        const baseKnots = baseWindSpeedKmH * 0.539957; // KNOTS_TO_MS is 0.539957 if converting kmh to knots
        let thermalAdditiveKnots = 0;
        const T = translations[currentLang];

        // Determine thermal strength based on overallScore and suckEffectScore
        const MIN_APP_SCORE = -7;
        const MAX_APP_SCORE = 14.5;
        const forecastHighThreshold = 10;
        const forecastMidThreshold = 5;
        const forecastLowThreshold = 0;

        let baseThermal_start, baseThermal_end, suckMultiplier_start, suckMultiplier_end;
        let tier_lower_bound, tier_upper_bound;

        if (overallScore >= forecastHighThreshold) { // High thermal potential
            tier_lower_bound = forecastHighThreshold; tier_upper_bound = MAX_APP_SCORE;
            baseThermal_start = 7.0; baseThermal_end = 8.0;
            suckMultiplier_start = 2.5; suckMultiplier_end = 3.0;
        } else if (overallScore >= forecastMidThreshold) { // Medium thermal potential
            tier_lower_bound = forecastMidThreshold; tier_upper_bound = forecastHighThreshold;
            baseThermal_start = 3.0; baseThermal_end = 6.0; // Ends below High's start
            suckMultiplier_start = 1.5; suckMultiplier_end = 2.2; // Ends below High's start
        } else if (overallScore >= forecastLowThreshold) { // Low thermal potential
            tier_lower_bound = forecastLowThreshold; tier_upper_bound = forecastMidThreshold;
            baseThermal_start = 1.0; baseThermal_end = 2.5; // Ends below Mid's start
            suckMultiplier_start = 1.0; suckMultiplier_end = 1.2; // Ends below Mid's start
        } else { // Bad thermal potential (overallScore < 0)
            tier_lower_bound = MIN_APP_SCORE; tier_upper_bound = forecastLowThreshold;
            baseThermal_start = 0.0; baseThermal_end = 0.5; // Ends below Low's start
            suckMultiplier_start = 0.2; suckMultiplier_end = 0.8; // Ends below Low's start
        }

        let progress = 0;
        const tier_span = tier_upper_bound - tier_lower_bound;
        if (tier_span > 0) {
            progress = (overallScore - tier_lower_bound) / tier_span;
        }
        progress = Math.min(1, Math.max(0, progress)); // Clamp progress to 0-1

        const currentBaseThermal = baseThermal_start + progress * (baseThermal_end - baseThermal_start);
        const currentSuckMultiplier = suckMultiplier_start + progress * (suckMultiplier_end - suckMultiplier_start);
        
        thermalAdditiveKnots = currentBaseThermal + suckEffectScore * currentSuckMultiplier;

        // Adjusted spread factor: minKnots will be base + 60% of thermal, making range width 40% of thermal
        let minKnots = baseKnots + thermalAdditiveKnots * 0.6;
        let maxKnots = baseKnots + thermalAdditiveKnots;

        if (baseKnots < 5 && thermalAdditiveKnots > 7) { // Strong thermal, low base
            minKnots = Math.max(minKnots, thermalAdditiveKnots * 0.5);
        }

        const isOptimalDirection = (windDirection >= 135 && windDirection <= 225); // Onshore for Raches
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

        const finalMinKnots = Math.max(0, Math.round(minKnots));
        const finalMaxKnots = Math.max(0, Math.round(maxKnots));

        if (finalMinKnots === 0 && finalMaxKnots === 0 && baseKnots < 1) {
             return `0-0 ${T.knotsUnit} (0.0-0.0 ${T.msUnit})`;
        }

        // Use global KNOTS_TO_MS for conversion from knots to m/s for display
        const displayMinMs = (finalMinKnots * KNOTS_TO_MS).toFixed(1);
        const displayMaxMs = (finalMaxKnots * KNOTS_TO_MS).toFixed(1);

        return `${finalMinKnots}-${finalMaxKnots} ${T.knotsUnit} (${displayMinMs}-${displayMaxMs} ${T.msUnit})`;
    }

    function displayResults(analysisResults) {
        // Ensure resultsContainer is defined and accessible, it's defined in DOMContentLoaded scope
        if (!analysisResults || analysisResults.length === 0) {
            resultsContainer.innerHTML = `<p class="placeholder">${translations[currentLang].placeholderDefault}</p>`;
            const chartSection = document.getElementById('chartSection');
            if (chartSection) chartSection.style.display = 'none';
            return;
        }

        resultsContainer.innerHTML = ''; // Clear previous results from the correct container
        const T = translations[currentLang]; // Translations
        const pointSuffix = T.pointsSuffix || 'pts'; // Suffix for points

        analysisResults.forEach(result => { // Changed 'data' to 'result' to match the loop variable
            // Prepare data for historical storage
            const historicalEntry = {};
            historicalEntry.date = result.date;
            historicalEntry.forecastLabelText = result.forecastLabel;
            
            const pKnots = result.predicted_wind_knots || { min: 0, max: 0 };
            const pMs = result.predicted_wind_ms || { min: 0, max: 0 };

            if (!result.predicted_wind_knots) {
                console.warn(`[displayResults] result.predicted_wind_knots was undefined for date ${result.date}. Using default {min:0, max:0}. Full result object:`, JSON.parse(JSON.stringify(result)));
            }
            // No separate warning for pMs, as it's usually paired; the log above shows the full result.

            const predictedWindKnotsText = `${pKnots.min}-${pKnots.max} ${T.knotsUnit}`;
            const predictedWindMsText = `(${(pMs.min).toFixed(1)}-${(pMs.max).toFixed(1)} ${T.msUnit})`;
            historicalEntry.predictedWindText = `${T.predictedWindLabel} ${predictedWindKnotsText} ${predictedWindMsText}`;

            historicalEntry.avgPredictedKnots = (pKnots.min + pKnots.max) / 2;
            historicalEntry.avgPredictedMs = (pMs.min + pMs.max) / 2;

            const cloudCoverResultForIcon = getCloudCoverScore(result.cloud_cover_value); // Get the full result for icon
            const cloudCoverResult = getCloudCoverScore(result.cloud_cover_value); // From processWeatherData
            historicalEntry.cloudCoverDetailText = `${cloudCoverResult.icon} ${T.cloudCoverLabel} ${result.cloud_cover_value}% (+${result.cloud_cover_score} ${pointSuffix})`;

            const tempDiffResult = getTempDiffScore(result.temp_diff_value); // From processWeatherData
            const tempDiffDescriptionText = T[result.temp_diff_description_key] || result.temp_diff_description_key; // Use the key from processWeatherData
            const tempDiffValueText = typeof result.temp_diff_value === 'number' ? result.temp_diff_value.toFixed(1) : 'N/A';
            const airTempValueText = typeof result.air_temp_value === 'number' ? result.air_temp_value.toFixed(1) : 'N/A';
            const seaTempValueText = typeof result.sea_temp_value === 'number' ? result.sea_temp_value.toFixed(1) : 'N/A';
            historicalEntry.tempDiffDetailText = `${tempDiffResult.icon} ${T.tempDiffDetail.replace('{description}', tempDiffDescriptionText).replace('{value}', tempDiffValueText).replace('{landTemp}', airTempValueText).replace('{seaTemp}', seaTempValueText)} (+${result.temp_diff_score} ${pointSuffix})`;
            
            // For wind speed, the icon is determined by the score in processWeatherData, let's assume it's passed or re-evaluate
            // We need to ensure wind_speed_icon is part of 'result' or call getWindSpeedIcon(result.wind_speed_score)
            // For now, let's assume processWeatherData adds wind_speed_icon to result
            const windSpeedValueText = typeof result.wind_speed_value === 'number' ? result.wind_speed_value.toFixed(1) : 'N/A';
            historicalEntry.maxWindSpeedApiDetailText = `${result.wind_speed_icon || '❓'} ${T.apiWindSpeedLabel} ${windSpeedValueText} km/h (+${result.wind_speed_score} ${pointSuffix})`;

            historicalEntry.windDirectionDetailText = `${getWindDirIcon(result.wind_direction_score)} ${T.windDirDetail.replace('{value}', result.wind_direction_value).replace('{description}', result.wind_direction_description)} (+${result.wind_direction_score} ${pointSuffix})`;

            const suckEffectDisplay = `${result.suck_effect_score_value}/3`;
            historicalEntry.suckEffectDetailText = `${getSuckEffectIcon(result.suck_effect_score_value)} ${T.suckEffectLabel} ${suckEffectDisplay} (+${result.suck_effect_score_value} ${pointSuffix})`;
            
            saveHistoricalEntry(historicalEntry);

            // Create and append result card
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';
            if (result.finalForecast === T.forecastBad) resultCard.classList.add('not-suitable');

            let weatherInfoHtml = `
                <h3>${new Date(result.date).toLocaleDateString(currentLang === 'bg' ? 'bg-BG' : 'en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</h3>
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
            resultsContainer.appendChild(resultCard);
        });

        renderHistoricalChart(); // Re-render chart after displaying new results
    }

    // Functions for historical data and chart rendering
    function getHistoricalData() {
        const data = localStorage.getItem(HISTORICAL_DATA_KEY);
        try {
            return data ? JSON.parse(data) : [];
        } catch (e) {
            console.error("Error parsing historical data:", e);
            return [];
        }
    }

    function saveHistoricalEntry(entry) {
        if (!entry || !entry.date) {
            console.error("Invalid entry for historical data:", entry);
            return;
        }
        let history = getHistoricalData();
        history = history.filter(item => item.date !== entry.date); // Remove old entry for the same date
        history.push(entry);
        history.sort((a, b) => new Date(a.date) - new Date(b.date)); 
        const MAX_HISTORY_DAYS = 90;
        if (history.length > MAX_HISTORY_DAYS) {
           history = history.slice(-MAX_HISTORY_DAYS);
        }
        localStorage.setItem(HISTORICAL_DATA_KEY, JSON.stringify(history));
    }

    function renderHistoricalChart() {
        const historicalData = getHistoricalData();
        const chartSection = document.getElementById('chartSection');
        const chartCanvas = document.getElementById('historicalWindChart');
        const chartTitleEl = document.getElementById('historicalChartTitleKey');

        if (chartTitleEl) {
            chartTitleEl.textContent = translations[currentLang].historicalChartTitleKey;
        }

        if (!historicalData || historicalData.length === 0) {
            if (chartSection) chartSection.style.display = 'none';
            if (historicalChartInstance) {
                historicalChartInstance.destroy();
                historicalChartInstance = null;
            }
            return;
        }

        if (chartSection) chartSection.style.display = 'block';

        const labels = historicalData.map(entry => {
            return new Date(entry.date).toLocaleDateString(currentLang === 'bg' ? 'bg-BG' : 'en-GB', {
                month: 'short', day: 'numeric'
            });
        });
        const avgKnotsData = historicalData.map(entry => entry.avgPredictedKnots);
        const avgMsData = historicalData.map(entry => entry.avgPredictedMs);

        const chartData = {
            labels: labels,
            datasets: [
                {
                    label: translations[currentLang].knotsUnit,
                    data: avgKnotsData,
                    borderColor: 'rgb(75, 192, 192)',
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    yAxisID: 'yKnots',
                    tension: 0.1
                },
                {
                    label: translations[currentLang].msUnit,
                    data: avgMsData,
                    borderColor: 'rgb(255, 99, 132)',
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',
                    yAxisID: 'yMs',
                    tension: 0.1
                }
            ]
        };

        if (historicalChartInstance) {
            historicalChartInstance.destroy();
        }

        const ctx = chartCanvas.getContext('2d');
        historicalChartInstance = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                stacked: false,
                plugins: {
                    title: {
                        display: false,
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                const dataIndex = context[0].dataIndex;
                                const entryDate = historicalData[dataIndex].date;
                                return new Date(entryDate).toLocaleDateString(currentLang === 'bg' ? 'bg-BG' : 'en-GB', {
                                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                                });
                            },
                            afterBody: function(context) {
                                const dataIndex = context[0].dataIndex;
                                const entry = historicalData[dataIndex];
                                if (!entry) return '';
                                let tooltipLines = [];
                                tooltipLines.push(`\n${entry.forecastLabelText}`);
                                tooltipLines.push(entry.predictedWindText);
                                tooltipLines.push(entry.cloudCoverDetailText);
                                tooltipLines.push(entry.tempDiffDetailText);
                                tooltipLines.push(entry.maxWindSpeedApiDetailText);
                                tooltipLines.push(entry.windDirectionDetailText);
                                tooltipLines.push(entry.suckEffectDetailText);
                                return tooltipLines;
                            }
                        }
                    }
                },
                scales: {
                    yKnots: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: translations[currentLang].knotsUnit
                        }
                    },
                    yMs: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: translations[currentLang].msUnit
                        },
                        grid: {
                            drawOnChartArea: false,
                        },
                    }
                }
            }
        });
    }

    // Modal functionality
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

    // Set initial language and render chart on load
    setLanguage('bg');
    renderHistoricalChart();
});