document.addEventListener('DOMContentLoaded', () => {
    // Координати за Рахес
    const RACHES_LAT = 38.867085;
    const RACHES_LON = 22.759371;

    const VOLOS_LAT = 39.3692;
    const VOLOS_LON = 22.9477;

    // --- START: Language and Translations ---
    let currentLang = 'bg';

    const translations = {
        en: {
            title: "💨 Raches Thermal Wind Forecaster",
            subtitle: "AI Assistant for thermal wind forecast in Raches",
            instructions: "Double-click a date for a single day, or select a date range",
            analyzeBtn: "Analyze",
            placeholderLoading: "Loading data and analyzing... 🧠",
            placeholderDefault: "Select a period and click 'Analyze' to see the forecast.",
            forecastHigh: "HIGH PROBABILITY OF GOOD CONDITIONS",
            forecastMid: "MEDIUM PROBABILITY OF GOOD CONDITIONS",
            forecastLow: "LOW PROBABILITY OF GOOD CONDITIONS",
            forecastBad: "NOT SUITABLE FOR KITING",
            forecastLabel: "🎯 Forecast:",
            scoreLabel: "📊 <b>Score: {score}</b> (from {minScore} to {maxScore})",
            predictedWindLabel: "Predicted Wind:",
            waterTempLabel: "Water Temperature:",
            apiWindSpeedLabel: "Max Wind Speed (API):",
            cloudCoverLabel: "Cloud Cover:",
            airTempLabel: "Air Temperature:",
            windDirLabel: "Wind Direction:",
            suckEffectLabel: "Suck Effect:",
            detailsLabel: "Details:",
            cloudCoverDetail: "{icon} Cloud Cover: {value}%",
            tempDiffDetail: "{icon} Temp Difference (Land-Sea): {value}°C (Land: {landTemp}°C, Sea: {seaTemp})",
            windSpeedDetail: "{icon} Max Wind Speed: {value} km/h",
            windDirOnshore: "{icon} Wind Direction: {value}° (Suitable - Onshore)",
            windDirOffshore: "{icon} Wind Direction: {value}° (Unsuitable - Offshore)",
            windDirSideshore: "{icon} Wind Direction: {value}° (Side-shore)",
            suckEffectDetail: "{icon} Suck Effect (Thermal Wind): {value}/3",
            knotsUnit: "knots",
            msUnit: "m/s",
            noData: "N/A",
            mapLink: "📍 Map",
            criteriaLink: "📋 Criteria",
            footerText: "Created with AI assistant. Data from <a href=\"https://open-meteo.com/\" target=\"_blank\">Open-Meteo</a>.",
            modalTitle: "Criteria for Thermal Wind in Raches",
            modalIntro: "In Raches, the thermal effect intensifies when the following 5 conditions are met simultaneously:",
            criteria1Title: "✅ 1. Sunny and clear sky (no clouds until noon)",
            criteria1Desc: "➡️ Windy: enable Clouds layer → look for very few clouds before 13:00. Why? The sun needs to heat the land to create a temperature difference between land and sea.",
            criteria2Title: "✅ 2. Land-sea temperature difference",
            criteria2Desc: "➡️ Windy: enable Airgram or Meteogram layer. Look for: Air temperature on land (e.g., 30°C). Sea temperature (usually 23–25°C). The greater the difference, the stronger the thermal breeze.",
            criteria3Title: "✅ 3. Weak to moderate synoptic circulation from east or northeast (ENE/NE)",
            criteria3Desc: "➡️ Windy: enable Wind layer → observe the arrows in the Raches area. The ideal scenario is 5–10 knots from ENE/NE in the morning (until noon). This \"helps\" the thermal effect without suppressing it.",
            criteria4Title: "✅ 4. No strong west or south wind",
            criteria4Desc: "➡️ It's important to have no wind against the thermal effect. Wind from W, SW, S will kill or reverse it. Avoid days with a forecast for west wind after 15:00.",
            criteria5Title: "✅ 5. Local suction effect (you can ‘see’ it in Windy by wind acceleration around 14–16h)",
            criteria5Desc: "➡️ Windy: in the Wind layer, place the cursor on the spot (Raches). If the wind sharply increases after 13:00 (e.g., from 6 to 15 knots), this is THERMAL INTENSIFICATION."
        },
        bg: {
            title: "💨 Raches Thermal Wind Forecaster",
            subtitle: "AI Асистент за прогноза на термичния вятър в Рахес",
            instructions: "Кликнете 2 пъти на една дата, или селектирайте период от дати",
            analyzeBtn: "Анализирай",
            placeholderLoading: "Зареждам данни и анализирам... 🧠",
            placeholderDefault: "Изберете период и натиснете 'Анализирай', за да видите прогнозата.",
            forecastHigh: "ВИСОКА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ",
            forecastMid: "СРЕДНА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ",
            forecastLow: "НИСКА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ",
            forecastBad: "НЕ Е ПОДХОДЯЩО ЗА КАЙТ",
            forecastLabel: "🎯 Прогноза:",
            scoreLabel: "📊 <b>Оценка: {score}</b> (от {minScore} до {maxScore})",
            predictedWindLabel: "Прогнозиран вятър:",
            waterTempLabel: "Температура на водата:",
            apiWindSpeedLabel: "Макс. скорост на вятър (API):",
            cloudCoverLabel: "Облачност:",
            airTempLabel: "Температура на въздуха:",
            windDirLabel: "Посока на вятър:",
            suckEffectLabel: "Suck ефект:",
            detailsLabel: "Детайли:",
            cloudCoverDetail: "{icon} Облачност: {value}%",
            tempDiffDetail: "{icon} Температурна разлика (суша-море): {value}°C (Суша: {landTemp}°C, Море: {seaTemp})",
            windSpeedDetail: "{icon} Макс. скорост на вятър: {value} km/h",
            windDirOnshore: "{icon} Посока на вятър: {value}° (Подходяща - Onshore)",
            windDirOffshore: "{icon} Посока на вятър: {value}° (Неподходяща - Offshore)",
            windDirSideshore: "{icon} Посока на вятър: {value}° (Странична - Side-shore)",
            suckEffectDetail: "{icon} Suck ефект (термичен вятър): {value}/3",
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
            criteria5Desc: "➡️ Windy: в слоя Wind, постави курсора на мястото на спота (Raches). Ако след 13:00 вятърът рязко се усилва (примерно от 6 на 15 възела), това е ТЕРМИЧНО ЗАСИЛВАНЕ."
        }
    };

    const setLanguage = (lang) => {
        if (!translations[lang]) return;
        currentLang = lang;
        document.querySelectorAll('[data-lang-key]').forEach(element => {
            const key = element.getAttribute('data-lang-key');
            if (translations[lang][key]) {
                element.innerHTML = translations[lang][key];
            }
        });
        document.getElementById('lang-bg').classList.toggle('active', lang === 'bg');
        document.getElementById('lang-en').classList.toggle('active', lang === 'en');
        
        const resultsContainer = document.getElementById('results-container');
        if (resultsContainer.querySelector('.placeholder')) {
             resultsContainer.innerHTML = `<p class="placeholder">${translations[currentLang].placeholderDefault}</p>`;
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

    async function processWeatherData(weatherData, marineData) {
        const dailyData = {};
        weatherData.daily.time.forEach((date, index) => {
            dailyData[date] = {
                cloud_cover: weatherData.daily.cloud_cover_mean[index],
                temperature_2m_max: weatherData.daily.temperature_2m_max[index],
                wind_speed_10m_max: weatherData.daily.wind_speed_10m_max[index],
                wind_direction_10m_dominant: weatherData.daily.wind_direction_10m_dominant[index],
                sea_temp: undefined,
                suck_effect_score: 0,
                predicted_wind_range: "N/A"
            };
        });
    
        if (marineData && marineData.hourly && marineData.hourly.time && marineData.hourly.sea_surface_temperature) {
            marineData.hourly.time.forEach((datetime, index) => {
                const date = datetime.split('T')[0];
                const hour = parseInt(datetime.split('T')[1].split(':')[0]);
                if (hour === 13 && dailyData[date]) {
                    dailyData[date].sea_temp = marineData.hourly.sea_surface_temperature[index];
                }
            });
        }

        let lastKnownSeaTemp = null;
        for (const date of weatherData.daily.time) {
            if (dailyData[date] && dailyData[date].sea_temp !== undefined && dailyData[date].sea_temp !== null) {
                lastKnownSeaTemp = dailyData[date].sea_temp;
                break;
            }
        }
        if (lastKnownSeaTemp === null) lastKnownSeaTemp = 15.0;

        for (const date of weatherData.daily.time) {
            if (dailyData[date]) {
                if (dailyData[date].sea_temp !== undefined && dailyData[date].sea_temp !== null) {
                    lastKnownSeaTemp = dailyData[date].sea_temp;
                } else {
                    dailyData[date].sea_temp = lastKnownSeaTemp;
                }
            }
        }
    
        const analysisResults = [];
    
        for (const date in dailyData) {
            const data = dailyData[date];
            let details = [];
            let score = 0;
            const T = translations[currentLang];
    
            // 1. Cloud Cover
            let cloudIcon = '';
            if (data.cloud_cover < 30) { score += 2; cloudIcon = '✅'; } 
            else if (data.cloud_cover < 60) { score += 1; cloudIcon = '⚠️'; } 
            else { cloudIcon = '❌'; }
            details.push(T.cloudCoverDetail.replace('{icon}', cloudIcon).replace('{value}', data.cloud_cover));
    
            // 2. Temperature Difference
            const tempDiff = data.temperature_2m_max - data.sea_temp;
            let tempIcon = '';
            if (tempDiff > 5) { score += 2; tempIcon = '✅'; } 
            else if (tempDiff > 2) { score += 1; tempIcon = '⚠️'; } 
            else { tempIcon = '❌'; }
            details.push(T.tempDiffDetail.replace('{icon}', tempIcon).replace('{value}', tempDiff.toFixed(1)).replace('{landTemp}', data.temperature_2m_max).replace('{seaTemp}', data.sea_temp !== undefined ? data.sea_temp + '°C' : T.noData));
    
            // 3. Wind Speed
            let windSpeedIcon = '';
            if (data.wind_speed_10m_max < 15) { score += 1; windSpeedIcon = '⚠️'; } 
            else if (data.wind_speed_10m_max < 25) { score += 2; windSpeedIcon = '✅'; } 
            else { score -= 2; windSpeedIcon = '❌'; }
            details.push(T.windSpeedDetail.replace('{icon}', windSpeedIcon).replace('{value}', data.wind_speed_10m_max));
    
            // 4. Wind Direction
            const windDir = data.wind_direction_10m_dominant;
            let windDirIcon = '';
            if (windDir >= 135 && windDir <= 225) {
                score += 1; windDirIcon = '✅';
                details.push(T.windDirOnshore.replace('{icon}', windDirIcon).replace('{value}', windDir));
            } else if (windDir >= 315 || windDir <= 45) {
                score -= 1; windDirIcon = '❌';
                details.push(T.windDirOffshore.replace('{icon}', windDirIcon).replace('{value}', windDir));
            } else {
                windDirIcon = '⚠️';
                details.push(T.windDirSideshore.replace('{icon}', windDirIcon).replace('{value}', windDir));
            }
    
            // 5. Suck Effect
            let suckEffectScore = 0;
            if (tempDiff > 6.5 && data.cloud_cover < 45) { suckEffectScore = 3; } 
            else if (tempDiff > 4 && data.cloud_cover < 60) { suckEffectScore = 2; } 
            else if (tempDiff > 2 && data.cloud_cover < 70) { suckEffectScore = 1; }
            data.suck_effect_score = suckEffectScore;
            score += suckEffectScore;
            let suckEffectIcon = '';
            if (suckEffectScore >= 2) { suckEffectIcon = '✅'; } 
            else if (suckEffectScore === 1) { suckEffectIcon = '⚠️'; } 
            else { suckEffectIcon = '❌'; }
            details.push(T.suckEffectDetail.replace('{icon}', suckEffectIcon).replace('{value}', suckEffectScore));
    
            const minScore = -3;
            const maxScore = 10;

            let finalForecast = "";
            if (score >= 7) finalForecast = T.forecastHigh;
            else if (score >= 4) finalForecast = T.forecastMid;
            else if (score >= 2) finalForecast = T.forecastLow;
            else finalForecast = T.forecastBad;
    
            data.predicted_wind_range = predictWindSpeedRange(data.cloud_cover, tempDiff, data.wind_speed_10m_max, data.wind_direction_10m_dominant, suckEffectScore);
    
            analysisResults.push({
                date: date, score: score, minScore: minScore, maxScore: maxScore,
                cloud_cover: data.cloud_cover, temperature_2m_max: data.temperature_2m_max,
                sea_temp: data.sea_temp, wind_speed: data.wind_speed_10m_max,
                wind_direction_10m_dominant: data.wind_direction_10m_dominant,
                suck_effect_score: suckEffectScore, finalForecast: finalForecast,
                predicted_wind_range: data.predicted_wind_range, details: details
            });
        }
        return analysisResults;
    }

    function predictWindSpeedRange(cloudCover, tempDiff, baseWindSpeed, windDirection, suckEffectScore) {
        const baseWindKnots = baseWindSpeed * 0.539957;
        let minKnots = baseWindKnots;
        let maxKnots = baseWindKnots;
        const T = translations[currentLang];

        if (suckEffectScore === 3) { minKnots = 18; maxKnots = 24; } 
        else if (suckEffectScore === 2) { minKnots = 16; maxKnots = 22; } 
        else if (suckEffectScore === 1) { minKnots = baseWindKnots + 3; maxKnots = baseWindKnots + 7; }

        const isOptimalDirection = (windDirection >= 135 && windDirection <= 225);
        if (isOptimalDirection && suckEffectScore >= 2) {
            minKnots = Math.min(minKnots + 1, maxKnots);
            maxKnots += 1;
        }

        if (minKnots > maxKnots) minKnots = maxKnots - 2;
        if (maxKnots - minKnots < 2 && maxKnots > 5) maxKnots = minKnots + 2;
        if (minKnots < 0) minKnots = 0;

        const finalMinKnots = Math.max(0, Math.round(minKnots));
        const finalMaxKnots = Math.max(finalMinKnots, Math.round(maxKnots));
        const KNOTS_TO_MS = 0.514444;

        if (finalMinKnots === 0 && finalMaxKnots === 0) {
            return `0-0 ${T.knotsUnit} (0.0-0.0 ${T.msUnit})`;
        }

        const finalMinMs = (finalMinKnots * KNOTS_TO_MS).toFixed(1);
        const finalMaxMs = (finalMaxKnots * KNOTS_TO_MS).toFixed(1);
        return `${finalMinKnots}-${finalMaxKnots} ${T.knotsUnit} (${finalMinMs}-${finalMaxMs} ${T.msUnit})`;
    }

    function displayResults(analysisResults) {
        const resultsDiv = document.getElementById('results-container');
        resultsDiv.innerHTML = '';
        const T = translations[currentLang];
    
        if (analysisResults.length === 0) {
            resultsDiv.innerHTML = `<p>${T.placeholderDefault}</p>`;
            return;
        }
    
        analysisResults.forEach(result => {
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';
            if (result.finalForecast === T.forecastBad) resultCard.classList.add('not-suitable');
            else if (result.finalForecast === T.forecastLow) resultCard.classList.add('neutral');
            else resultCard.classList.add('suitable');
    
            const scoreText = T.scoreLabel.replace('{score}', result.score).replace('{minScore}', result.minScore).replace('{maxScore}', result.maxScore);
            const seaTempText = result.sea_temp !== undefined ? result.sea_temp + '°C' : T.noData;
            const apiWindText = result.wind_speed !== undefined ? `${(result.wind_speed * 0.539957).toFixed(1)} ${T.knotsUnit} (${result.wind_speed} km/h)` : T.noData;

            let weatherInfoHtml = `
                <h3>${result.date}</h3>
                <p>${T.forecastLabel} ${result.finalForecast}</p>
                <p>${scoreText}</p>
                <p>${T.predictedWindLabel} <b>${result.predicted_wind_range}</b></p> 
                <p>${T.waterTempLabel} ${seaTempText}</p>
                <p>${T.apiWindSpeedLabel} ${apiWindText}</p>
                <p>${T.cloudCoverLabel} ${result.cloud_cover}%</p>
                <p>${T.airTempLabel} ${result.temperature_2m_max}°C</p>
                <p>${T.windDirLabel} ${result.wind_direction_10m_dominant}°</p>
                <p>${T.suckEffectLabel} ${result.suck_effect_score}</p>
            `;
    
            if (result.details) {
                weatherInfoHtml += `<h4>${T.detailsLabel}</h4><ul>`;
                result.details.forEach(detail => {
                    weatherInfoHtml += `<li>${detail}</li>`;
                });
                weatherInfoHtml += '</ul>';
            }
    
            resultCard.innerHTML = weatherInfoHtml;
            resultsDiv.appendChild(resultCard);
        });
    }

    // Set initial language
    setLanguage('bg');

    // Modal functionality
    const modal = document.getElementById('criteria-modal');
    const criteriaLink = document.getElementById('criteria-link');
    const closeButton = document.querySelector('.close-button');

    criteriaLink.onclick = function(event) {
        event.preventDefault(); // Prevent page jump for # href
        modal.style.display = 'block';
    }

    closeButton.onclick = function() {
        modal.style.display = 'none';
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    }
});