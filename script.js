const KNOTS_TO_MS = 0.514444; // Define globally

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
            tempDiffDetail: "{icon} Temp Difference (Land-Sea): {description} ({value}°C) (Land: {landTemp}°C, Sea: {seaTemp})",
            windSpeedDetail: "{icon} Max Wind Speed: {value} km/h",
            windDirDetail: "{icon} Wind Direction: {value}° ({description})", // Generic wind direction detail
            windDirOnshore: "Suitable - Onshore",
            windDirOffshore: "Unsuitable - Offshore",
            windDirSideShore: "Side-shore",
            windDirOffshoreBad: "Unsuitable - Directly Offshore (Bad)",
            windDirSideOff: "Side-Offshore (Not Ideal)",
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
            criteria5Desc: "➡️ Windy: in the Wind layer, place the cursor on the spot (Raches). If the wind sharply increases after 13:00 (e.g., from 6 to 15 knots), this is THERMAL INTENSIFICATION.",
            pointsSuffix: "pts",
            tempDiffHigh: "High",
            tempDiffMedium: "Medium",
            tempDiffLow: "Low",
            tempDiffVeryLow: "Very Low"
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
            tempDiffDetail: "{icon} Температурна разлика (суша-море): {description} ({value}°C) (Суша: {landTemp}°C, Море: {seaTemp}°C)",
            windSpeedDetail: "{icon} Макс. скорост на вятър: {value} km/h",
            windDirDetail: "{icon} Посока на вятър: {value}° ({description})", // Общ ключ за посока на вятъра
            windDirOnshore: "Подходяща - Onshore",
            windDirOffshore: "Неподходяща - Offshore",
            windDirSideShore: "Странична - Side-shore",
            windDirOffshoreBad: "Неподходяща - Директно Offshore (Лоша)",
            windDirSideOff: "Странично-Offshore (Не идеална)",
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
        if (tempDiff >= 8) return { score: 3.5, icon: '✅', textKey: 'tempDiffHigh' };
        if (tempDiff >= 7) return { score: 3, icon: '✅', textKey: 'tempDiffHigh' };
        if (tempDiff >= 6) return { score: 2.5, icon: '✅', textKey: 'tempDiffHigh' };
        if (tempDiff >= 5) return { score: 2, icon: '✅', textKey: 'tempDiffHigh' };
        if (tempDiff >= 4) return { score: 1.5, icon: '⚠️', textKey: 'tempDiffMedium' };
        if (tempDiff >= 3) return { score: 1, icon: '⚠️', textKey: 'tempDiffMedium' };
        if (tempDiff >= 2) return { score: 0.5, icon: '⚠️', textKey: 'tempDiffLow' }; // Added textKey for 0.5 score
        if (tempDiff >= 1) return { score: 0, icon: '❌', textKey: 'tempDiffLow' }; // Changed icon for 0 score to neutral or slightly neg
        return { score: -1, icon: '❌', textKey: 'tempDiffVeryLow' }; // < 1
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
            let suckEffectScore = 0; // Initialize suckEffectScore for the current day
            const T = translations[currentLang];

            // Calculate Suck Effect Score for the current date
            // Find morning (e.g., 10:00) and afternoon (e.g., 16:00) wind speeds from weatherData.hourly
            console.log(`Debugging Suck Effect for date: ${date}`); // Log date
            let morningWindSpeed = null;
            let afternoonWindSpeed = null;

            if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.windspeed_10m) { // Corrected key
                const hourlyTimes = weatherData.hourly.time;
                const hourlyWindSpeeds = weatherData.hourly.windspeed_10m; // Corrected key

                for (let i = 0; i < hourlyTimes.length; i++) {
                    const hourlyDateTime = hourlyTimes[i];
                    const entryDate = hourlyDateTime.split('T')[0];
                    const entryHour = parseInt(hourlyDateTime.split('T')[1].split(':')[0]);

                    if (entryDate === date) {
                        if (entryHour >= 9 && entryHour <= 11) { // Capture around 10:00
                            if (morningWindSpeed === null || hourlyWindSpeeds[i] > morningWindSpeed) {
                                 // Take max in the morning window if multiple, or just first good one
                                morningWindSpeed = hourlyWindSpeeds[i]; 
                            }
                        }
                        if (entryHour >= 15 && entryHour <= 17) { // Capture around 16:00
                            if (afternoonWindSpeed === null || hourlyWindSpeeds[i] > afternoonWindSpeed) {
                                // Take max in the afternoon window
                                afternoonWindSpeed = hourlyWindSpeeds[i]; 
                            }
                        }
                    }
                }
            }

            console.log(morningWindSpeed, afternoonWindSpeed)
            
            if (morningWindSpeed !== null && afternoonWindSpeed !== null) {
                const windIncreaseKmh = afternoonWindSpeed - morningWindSpeed;
                console.log(`Suck Effect Calculation for ${date}: Morning Wind: ${morningWindSpeed} km/h, Afternoon Wind: ${afternoonWindSpeed} km/h, Increase: ${windIncreaseKmh} km/h`);
                // Scoring based on wind increase (example thresholds, adjust as needed)
                // Wind speeds are in km/h from API
                if (windIncreaseKmh >= 15) { suckEffectScore = 3; }
                else if (windIncreaseKmh >= 10) { suckEffectScore = 2; }
                else if (windIncreaseKmh >= 5) { suckEffectScore = 1; }
                else { suckEffectScore = 0; }
                console.log(`Suck Effect Score for ${date}: ${suckEffectScore}`);
            } else {
                console.warn(`Suck Effect: Insufficient data for ${date} - Morning: ${morningWindSpeed}, Afternoon: ${afternoonWindSpeed}`);
            }
            score += suckEffectScore; // Add to total score
            data.suck_effect_score = suckEffectScore; // Store it in the data object for display

            // 1. Cloud Cover (Granular)
            const cloudCoverResult = getCloudCoverScore(data.cloud_cover);
            score += cloudCoverResult.score;
            details.push(T.cloudCoverDetail.replace('{icon}', cloudCoverResult.icon).replace('{value}', data.cloud_cover) + ` (${cloudCoverResult.score > 0 ? '+' : ''}${cloudCoverResult.score} ${T.pointsSuffix || 'pts'})`);

            // Temperature Difference Score
            const tempDiff = data.temperature_2m_max - data.sea_temp;
            const tempDiffResult = getTempDiffScore(tempDiff);
            score += tempDiffResult.score;
            const tempDescriptionText = T[tempDiffResult.textKey] || tempDiffResult.textKey; // Safety check
            details.push(
                T.tempDiffDetail
                    .replace('{icon}', tempDiffResult.icon) // Correctly replace icon
                    .replace('{description}', tempDescriptionText)
                    .replace('{value}', tempDiff.toFixed(1))
                    .replace('{landTemp}', data.temperature_2m_max)
                    .replace('{seaTemp}', data.sea_temp)
                + ` (${tempDiffResult.score > 0 ? '+' : ''}${tempDiffResult.score} ${T.pointsSuffix || 'pts'})`
            );

            // Wind Speed Score (from API)
            let windSpeedScore = 0;
            let windSpeedIcon = '';
            if (data.wind_speed_10m_max >= 15 && data.wind_speed_10m_max <= 30) { windSpeedScore = 2; windSpeedIcon = '✅'; }
            else if (data.wind_speed_10m_max > 30 && data.wind_speed_10m_max <= 40) { windSpeedScore = 1; windSpeedIcon = '⚠️'; }
            else if (data.wind_speed_10m_max < 15 && data.wind_speed_10m_max >=5) { windSpeedScore = 0; windSpeedIcon = '❌'; }
            else if (data.wind_speed_10m_max < 5) { windSpeedScore = -1; windSpeedIcon = '❌'; }
            else { windSpeedScore = -2; windSpeedIcon = '❌'; }
            score += windSpeedScore;
            details.push(T.windSpeedDetail.replace('{icon}', windSpeedIcon).replace('{value}', data.wind_speed_10m_max.toFixed(1)) + ` (${windSpeedScore > 0 ? '+' : ''}${windSpeedScore} ${T.pointsSuffix || 'pts'})`);

            // Wind Direction Score
            let windDirectionScore = 0;
            let windDirIcon = '';
            let windDirDescKey = ''; // Key for translation
            const dir = data.wind_direction_10m_dominant;

            if ((dir >= 45 && dir <= 135)) { // Onshore to side-onshore (E is 90)
                windDirectionScore = 1; windDirIcon = '✅'; windDirDescKey = 'windDirOnshore';
            } else if ((dir > 135 && dir <= 180) || (dir >= 0 && dir < 45)) { // Side-shore (S or N)
                windDirectionScore = 0; windDirIcon = '⚠️'; windDirDescKey = 'windDirSideShore';
            } else { // Offshore or side-offshore (Westerly components)
                windDirectionScore = -1; windDirIcon = '❌'; windDirDescKey = 'windDirOffshore';
            }
            // Specific adjustments for Raches (East-facing spot)
            if (dir > 180 && dir < 360) { // Westerly components are generally bad
                 if (dir >= 225 && dir <= 315) { // Directly offshore W, NW, SW
                    windDirectionScore = -2; windDirDescKey = 'windDirOffshoreBad'; // Use a more specific key if needed or append to existing
                 } else { // Side-offshore (e.g. WNW, WSW)
                    windDirectionScore = -1; windDirDescKey = 'windDirSideOff';
                 }
            }
            score += windDirectionScore;
            const windDirectionDescriptionText = T[windDirDescKey] || windDirDescKey; // Safety check
            // Use the generic T.windDirDetail for structure
            details.push(T.windDirDetail.replace('{icon}', windDirIcon).replace('{value}', dir).replace('{description}', windDirectionDescriptionText) + ` (${windDirectionScore > 0 ? '+' : ''}${windDirectionScore} ${T.pointsSuffix || 'pts'})`);

            // Suck Effect Score
            let suckEffectIcon = '';
            if (suckEffectScore >= 2) { suckEffectIcon = '✅'; } 
            else if (suckEffectScore === 1) { suckEffectIcon = '⚠️'; } 
            else { suckEffectIcon = '❌'; }
            details.push(T.suckEffectDetail.replace('{icon}', suckEffectIcon).replace('{value}', suckEffectScore) + ` (${suckEffectScore > 0 ? '+' : ''}${suckEffectScore} ${T.pointsSuffix || 'pts'})`);
    
            // Min/Max scores based on: Cloud (-3 to +5), TempDiff (-1 to +3.5), WindSpeed (-2 to +2), WindDir (-1 to +1), SuckEffect (0 to +3)
            const minScore = -3 - 1 - 2 - 1 + 0; // = -7
            const maxScore = 5 + 3.5 + 2 + 1 + 3;    // = 14.5

            let finalForecast = "";
            // Adjusted thresholds based on new score range (-7 to 14.5)
            if (score >= 10) finalForecast = T.forecastHigh;
            else if (score >= 5) finalForecast = T.forecastMid;
            else if (score >= 0) finalForecast = T.forecastLow;
            else finalForecast = T.forecastBad;
    
            data.predicted_wind_range = predictWindSpeedRange(data.wind_speed_10m_max, score, suckEffectScore, data.wind_direction_10m_dominant);
    
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