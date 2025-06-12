document.addEventListener('DOMContentLoaded', () => {
    // Координати за Рахес
    const RACHES_LAT = 38.867085;
    const RACHES_LON = 22.759371;

    const VOLOS_LAT = 39.3692;
    const VOLOS_LON = 22.9477;


    // Инициализация на календара
    const datePicker = flatpickr("#date-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
        minDate: "today",
        maxDate: new Date().fp_incr(15) // Позволява прогноза до 16 дни напред
    });

    const analyzeBtn = document.getElementById('analyze-btn');
    const resultsContainer = document.getElementById('results-container');
    
    resultsContainer.innerHTML = `<p class="placeholder">Изберете период и натиснете "Анализирай", за да видите прогнозата.</p>`;

    analyzeBtn.addEventListener('click', () => {
        const selectedDates = datePicker.selectedDates;
        if (selectedDates.length < 2) {
            // Ако е избрана само една дата, автоматично я правим период от един ден
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

    // Функция за форматиране на дата
    function formatDate(date) {
        const d = new Date(date),
              year = d.getFullYear(),
              month = ('0' + (d.getMonth() + 1)).slice(-2),
              day = ('0' + d.getDate()).slice(-2);
        return [year, month, day].join('-');
    }

    // Основна функция за взимане и анализ на данните
    async function fetchAndAnalyze(startDate, endDate) {
        resultsContainer.innerHTML = `<p class="placeholder">Зареждам данни и анализирам... 🧠</p>`;
        
        const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RACHES_LAT}&longitude=${RACHES_LON}&hourly=temperature_2m,cloudcover,windspeed_10m,winddirection_10m&daily=cloud_cover_mean,temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&start_date=${startDate}&end_date=${endDate}`;
        const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${VOLOS_LAT}&longitude=${VOLOS_LON}&hourly=sea_surface_temperature&start_date=${startDate}&end_date=${endDate}&timezone=auto`;

        try {
            // Изпращаме двете заявки едновременно и чакаме и двете да се върнат
            const [weatherResponse, marineResponse] = await Promise.all([
                fetch(weatherApiUrl),
                fetch(marineApiUrl)
            ]);

            if (!weatherResponse.ok || !marineResponse.ok) {
                throw new Error('Проблем при връзката с API-то за времето.');
            }
            
            const weatherData = await weatherResponse.json();
            const marineData = await marineResponse.json();

            const analysisResults = await processWeatherData(weatherData, marineData); // Добавено await, тъй като processWeatherData е async
            displayResults(analysisResults); // Коригирано от renderResults на displayResults
        } catch (error) {
            resultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Грешка: ${error.message}</p>`;
        }
    }

    // Функция за обработка на данните от ДВАТА API източника
    async function processWeatherData(weatherData, marineData) {
        const dailyData = {};
        // Initialize dailyData with dates from weatherData
        weatherData.daily.time.forEach((date, index) => {
            dailyData[date] = {
                cloud_cover: weatherData.daily.cloud_cover_mean[index],
                temperature_2m_max: weatherData.daily.temperature_2m_max[index],
                wind_speed_10m_max: weatherData.daily.wind_speed_10m_max[index],
                wind_direction_10m_dominant: weatherData.daily.wind_direction_10m_dominant[index],
                sea_temp: undefined, // Will be populated from marineData
                suck_effect_score: 0,
                predicted_wind_range: "N/A" // New field for predicted wind range
            };
        });
    
        // Populate sea_temp from marineData (hourly, around 13:00)
        if (marineData && marineData.hourly && marineData.hourly.time && marineData.hourly.sea_surface_temperature) {
            marineData.hourly.time.forEach((datetime, index) => {
                const date = datetime.split('T')[0];
                const hour = parseInt(datetime.split('T')[1].split(':')[0]);
                if (hour === 13 && dailyData[date]) {
                    dailyData[date].sea_temp = marineData.hourly.sea_surface_temperature[index];
                }
            });
        }

        // Fill in missing sea temperature data with the last known value
        let lastKnownSeaTemp = null;
        // First pass to find an initial value and handle cases where the first days are missing data
        for (const date of weatherData.daily.time) {
            if (dailyData[date] && dailyData[date].sea_temp !== undefined && dailyData[date].sea_temp !== null) {
                lastKnownSeaTemp = dailyData[date].sea_temp;
                break;
            }
        }
        // If no data at all, use a default
        if (lastKnownSeaTemp === null) {
            lastKnownSeaTemp = 15.0;
        }

        // Second pass to fill the gaps
        for (const date of weatherData.daily.time) {
            if (dailyData[date]) {
                if (dailyData[date].sea_temp !== undefined && dailyData[date].sea_temp !== null) {
                    lastKnownSeaTemp = dailyData[date].sea_temp; // Update last known temp
                } else {
                    dailyData[date].sea_temp = lastKnownSeaTemp; // Use last known temp
                }
            }
        }
    
        const analysisResults = [];
    
        for (const date in dailyData) {
            const data = dailyData[date];
            let details = [];
            let score = 0;
    
            // Criteria evaluation with icons
            // 1. Cloud Cover
            let cloudIcon = '';
            if (data.cloud_cover < 30) {
                score += 2; // Good
                cloudIcon = '✅';
            } else if (data.cloud_cover < 60) {
                score += 1; // Neutral
                cloudIcon = '⚠️';
            } else {
                cloudIcon = '❌';
            }
            details.push(`${cloudIcon} Облачност: ${data.cloud_cover}%`);
    
            // 2. Temperature Difference (Land vs Sea)
            const tempDiff = data.temperature_2m_max - (data.sea_temp || 15); // Use 15 as default sea_temp if N/A
            let tempIcon = '';
            if (tempDiff > 5) {
                score += 2; // Good
                tempIcon = '✅';
            } else if (tempDiff > 2) {
                score += 1; // Neutral
                tempIcon = '⚠️';
            } else {
                tempIcon = '❌';
            }
            details.push(`${tempIcon} Температурна разлика (суша-море): ${tempDiff.toFixed(1)}°C (Суша: ${data.temperature_2m_max}°C, Море: ${data.sea_temp !== undefined ? data.sea_temp + '°C' : 'N/A'})`);
    
            // 3. Wind Speed
            let windSpeedIcon = '';
            if (data.wind_speed_10m_max < 15) {
                score += 1; // Neutral (low wind)
                windSpeedIcon = '⚠️';
            } else if (data.wind_speed_10m_max < 25) {
                score += 2; // Good (moderate wind)
                windSpeedIcon = '✅';
            } else {
                score -= 1; // Potentially too strong
                windSpeedIcon = '❌';
            }
            details.push(`${windSpeedIcon} Макс. скорост на вятър: ${data.wind_speed_10m_max} km/h`);
    
            // 4. Wind Direction (calibrated for a South-facing beach like Raches/Kouvela) - НАМАЛЕНА ТЕЖЕСТ
            const windDir = data.wind_direction_10m_dominant;
            let windDirIcon = '';
            // Ideal direction is onshore (SE to SW).
            if (windDir >= 135 && windDir <= 225) { // Onshore (SE to SW)
                score += 1; // Good direction (was 2)
                windDirIcon = '✅';
                details.push(`${windDirIcon} Посока на вятър: ${windDir}° (Подходяща - Onshore)`);
            } else if (windDir >= 315 || windDir <= 45) { // Offshore (NW to NE)
                score -= 1; // Bad direction
                windDirIcon = '❌';
                details.push(`${windDirIcon} Посока на вятър: ${windDir}° (Неподходяща - Offshore)`);
            } else { // Side-shore
                // score += 0; // Neutral (was 1) - No change
                windDirIcon = '⚠️';
                details.push(`${windDirIcon} Посока на вятър: ${windDir}° (Странична - Side-shore)`);
            }

            // 5. Suck Effect (Thermal Wind Potential) - More lenient thresholds to match reality
            let suckEffectScore = 0;
            if (tempDiff > 6.5 && data.cloud_cover < 45) { // Was > 7 and < 40
                suckEffectScore = 3; // Strong suck effect
            } else if (tempDiff > 4 && data.cloud_cover < 60) { // Was > 4 and < 50
                suckEffectScore = 2; // Moderate suck effect
            } else if (tempDiff > 2 && data.cloud_cover < 70) { // Was > 2 and < 60
                suckEffectScore = 1; // Weak suck effect
            }
            data.suck_effect_score = suckEffectScore;
            score += suckEffectScore;
            let suckEffectIcon = '';
            if (suckEffectScore >= 2) {
                suckEffectIcon = '✅';
            } else if (suckEffectScore === 1) {
                suckEffectIcon = '⚠️';
            } else {
                suckEffectIcon = '❌';
            }
            details.push(`${suckEffectIcon} Suck ефект (термичен вятър): ${suckEffectScore}/3`);

            // Min/Max scores are calculated based on the sum of min/max points from each criterion:
            // Cloud (0/2), Temp (0/2), Wind Speed (-1/2), Wind Dir (-1/1), Suck (0/3)
            const minScore = -2;
            const maxScore = 10;

            let finalForecast = "";
            // Adjusted thresholds based on new max score of 10
            if (score >= 7) finalForecast = "ВИСОКА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ";
            else if (score >= 4) finalForecast = "СРЕДНА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ";
            else if (score >= 2) finalForecast = "НИСКА ВЕРОЯТНОСТ ЗА ДОБРИ УСЛОВИЯ";
            else finalForecast = "НЕ Е ПОДХОДЯЩО ЗА КАЙТ";

            // Predict wind speed range
            data.predicted_wind_range = predictWindSpeedRange(
                data.cloud_cover,
                tempDiff,
                data.wind_speed_10m_max, // Use the actual max wind speed from API as a base
                data.wind_direction_10m_dominant,
                suckEffectScore
            );

            analysisResults.push({
                date: date,
                score: score,
                minScore: minScore,
                maxScore: maxScore,
                cloud_cover: data.cloud_cover,
                temperature_2m_max: data.temperature_2m_max,
                sea_temp: data.sea_temp,
                wind_speed: data.wind_speed_10m_max,
                wind_direction_10m_dominant: data.wind_direction_10m_dominant,
                suck_effect_score: suckEffectScore,
                finalForecast: finalForecast,
                predicted_wind_range: data.predicted_wind_range, // Add to results
                details: details
            });        }
        // displayResults(analysisResults); // Премахнато извикване от тук, за да не се дублира
        return analysisResults;
    }

    function predictWindSpeedRange(cloudCover, tempDiff, baseWindSpeed, windDirection, suckEffectScore) {
        const baseWindKnots = baseWindSpeed * 0.539957;
        let minKnots = baseWindKnots;
        let maxKnots = baseWindKnots;

        // New logic: Use suckEffectScore to determine the wind profile.
        // For strong thermal days, we largely IGNORE the base wind and set a new range.
        if (suckEffectScore === 3) { // Prime thermal day: 18-24 knots
            minKnots = 18;
            maxKnots = 24;
        } else if (suckEffectScore === 2) { // Good thermal day: 16-22 knots
            minKnots = 16;
            maxKnots = 22;
        } else if (suckEffectScore === 1) { // Weak thermal day, boost the base wind
            minKnots = baseWindKnots + 3;
            maxKnots = baseWindKnots + 7;
        }
        // If suckEffectScore is 0, we just use the base wind from the API.

        // Add a small adjustment for optimal direction, as it can help stabilize the thermal.
        const isOptimalDirection = (windDirection >= 135 && windDirection <= 225);
        if (isOptimalDirection && suckEffectScore >= 2) {
            // If the direction is perfect, the wind might be slightly stronger and more stable.
            minKnots = Math.min(minKnots + 1, maxKnots); // Add 1 but don't exceed max
            maxKnots += 1;
        }

        // Final cleanup and formatting
        if (minKnots > maxKnots) {
            minKnots = maxKnots - 2; // Ensure a small range
        }
        if (maxKnots - minKnots < 2 && maxKnots > 5) {
            maxKnots = minKnots + 2;
        }
        if (minKnots < 0) minKnots = 0;

        const finalMinKnots = Math.max(0, Math.round(minKnots));
        const finalMaxKnots = Math.max(finalMinKnots, Math.round(maxKnots));

        const KNOTS_TO_MS = 0.514444;

        if (finalMinKnots === 0 && finalMaxKnots === 0) {
            return "0-0 възли (0.0-0.0 м/с)";
        }

        const finalMinMs = (finalMinKnots * KNOTS_TO_MS).toFixed(1);
        const finalMaxMs = (finalMaxKnots * KNOTS_TO_MS).toFixed(1);
        return `${finalMinKnots}-${finalMaxKnots} възли (${finalMinMs}-${finalMaxMs} м/с)`;
    }

    function displayResults(analysisResults) {
        const resultsDiv = document.getElementById('results-container');
        resultsDiv.innerHTML = ''; // Clear previous results
    
        if (analysisResults.length === 0) {
            resultsDiv.innerHTML = '<p>Няма намерени подходящи дни въз основа на зададените критерии.</p>';
            return;
        }
    
        analysisResults.forEach(result => {
            const resultCard = document.createElement('div');
            resultCard.className = 'result-card';
            if (result.finalForecast.includes("НЕ Е ПОДХОДЯЩО")) {
                resultCard.classList.add('not-suitable');
            } else if (result.finalForecast.includes("ПОДХОДЯЩО") || result.finalForecast.includes("ВИСОКА ВЕРОЯТНОСТ") || result.finalForecast.includes("СРЕДНА ВЕРОЯТНОСТ")) {
                resultCard.classList.add('suitable');
            } else {
                resultCard.classList.add('neutral');
            }
    
            let weatherInfoHtml = `
                <h3>${result.date}</h3>
                <p>🎯 Прогноза: ${result.finalForecast}</p>
                <p>📊 <b>Оценка: ${result.score}</b> (от ${result.minScore} до ${result.maxScore})</p>
                <p>Прогнозиран вятър: <b>${result.predicted_wind_range}</b></p> 
                <p>Температура на водата: ${result.sea_temp !== undefined ? result.sea_temp + '°C' : 'N/A'}</p>
                <p>Макс. скорост на вятър (API): ${result.wind_speed !== undefined ? (result.wind_speed * 0.539957).toFixed(1) + ' възли (' + result.wind_speed + ' km/h)' : 'N/A'}</p>
                <p>Облачност: ${result.cloud_cover}%</p>
                <p>Температура на въздуха: ${result.temperature_2m_max}°C</p>
                <p>Посока на вятър: ${result.wind_direction_10m_dominant}°</p>
                <p>Suck ефект: ${result.suck_effect_score}</p>
            `;
    
            if (result.details) {
                weatherInfoHtml += '<h4>Детайли:</h4><ul>';
                result.details.forEach(detail => {
                    weatherInfoHtml += `<li>${detail}</li>`;
                });
                weatherInfoHtml += '</ul>';
            }
    
            resultCard.innerHTML = weatherInfoHtml;
            resultsDiv.appendChild(resultCard);
        });
    }
});