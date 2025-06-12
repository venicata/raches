document.addEventListener('DOMContentLoaded', () => {
    // Координати за Рахес
    const RACHES_LAT = 38.86;
    const RACHES_LON = 22.78;
    const SEA_TEMP_ASSUMPTION = 23; // Приблизителна температура на морето

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
            alert("Моля, изберете период от дати.");
            return;
        }

        const startDate = formatDate(selectedDates[0]);
        const endDate = formatDate(selectedDates[1]);
        
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
        
        const apiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RACHES_LAT}&longitude=${RACHES_LON}&hourly=temperature_2m,cloudcover,windspeed_10m,winddirection_10m&start_date=${startDate}&end_date=${endDate}`;

        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('Проблем при връзката с API-то за времето.');
            }
            const data = await response.json();
            const analysisResults = processWeatherData(data);
            renderResults(analysisResults);
        } catch (error) {
            resultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Грешка: ${error.message}</p>`;
        }
    }

    // Функция за обработка на данните от API
    function processWeatherData(data) {
        const dailyData = {};
        data.hourly.time.forEach((time, index) => {
            const date = time.split('T')[0];
            if (!dailyData[date]) {
                dailyData[date] = {
                    hours: [],
                    temps: [],
                    clouds: [],
                    windspeeds: [],
                    winddirs: []
                };
            }
            dailyData[date].hours.push(parseInt(time.split('T')[1].split(':')[0]));
            dailyData[date].temps.push(data.hourly.temperature_2m[index]);
            dailyData[date].clouds.push(data.hourly.cloudcover[index]);
            dailyData[date].windspeeds.push(data.hourly.windspeed_10m[index] * 0.54); // Преобразуване от km/h в knots
            dailyData[date].winddirs.push(data.hourly.winddirection_10m[index]);
        });

        const analysis = {};
        for (const date in dailyData) {
            analysis[date] = analyzeDay(dailyData[date]);
        }
        return analysis;
    }

    // "AI Агент" - функцията, която анализира деня по 5-те критерия
    function analyzeDay(dayData) {
        const results = {
            criteria: [false, false, false, false, false],
            details: {}
        };

        // 1. Слънчево и ясно небе (до обяд)
        const morningClouds = dayData.clouds.slice(8, 14); // 8:00 - 13:00
        const avgMorningClouds = morningClouds.reduce((a, b) => a + b, 0) / morningClouds.length;
        if (avgMorningClouds < 25) { // Под 25% средна облачност
            results.criteria[0] = true;
        }
        results.details.clouds = `Средна сутрешна облачност: ${avgMorningClouds.toFixed(0)}%`;

        // 2. Температурна разлика суша-море
        const maxTemp = Math.max(...dayData.temps);
        const tempDiff = maxTemp - SEA_TEMP_ASSUMPTION;
        if (tempDiff >= 6) { // Разлика от 6+ градуса
            results.criteria[1] = true;
        }
        results.details.temp = `Макс. темп. на сушата: ${maxTemp.toFixed(1)}°C. Разлика: ${tempDiff.toFixed(1)}°C`;

        // 3. Слаба синоптична циркулация от ENE/NE
        const morningWindspeeds = dayData.windspeeds.slice(8, 13); // 8:00 - 12:00
        const morningWinddirs = dayData.winddirs.slice(8, 13);
        const avgMorningWindspeed = morningWindspeeds.reduce((a, b) => a + b, 0) / morningWindspeeds.length;
        const dominantMorningDir = morningWinddirs.filter(dir => dir >= 30 && dir <= 90).length > morningWinddirs.length / 2;
        if (avgMorningWindspeed >= 4 && avgMorningWindspeed <= 12 && dominantMorningDir) {
            results.criteria[2] = true;
        }
        results.details.synoptic = `Сутрешен вятър: ~${avgMorningWindspeed.toFixed(0)} възела от NE/ENE`;

        // 4. Без силен западен или южен вятър
        const afternoonWinddirs = dayData.winddirs.slice(14, 19);
        const hasOpposingWind = afternoonWinddirs.some(dir => dir >= 160 && dir <= 320);
        if (!hasOpposingWind) {
            results.criteria[3] = true;
        }
        results.details.opposing = hasOpposingWind ? "Има противоположен вятър!" : "Няма противоположен вятър.";

        // 5. Местен ефект на засмукване
        const afternoonWindspeeds = dayData.windspeeds.slice(14, 18);
        const maxAfternoonWindspeed = Math.max(...afternoonWindspeeds);
        if (maxAfternoonWindspeed > avgMorningWindspeed + 5 && maxAfternoonWindspeed > 13) {
            results.criteria[4] = true;
        }
        results.details.suck_effect = `Пик на вятъра следобед: ${maxAfternoonWindspeed.toFixed(0)} възела.`;

        // Финална оценка
        const score = results.criteria.filter(Boolean).length;
        if (score === 5) {
            results.finalForecast = "ВИСОКА ВЕРОЯТНОСТ";
            results.cssClass = "high";
        } else if (score >= 3) {
            results.finalForecast = "СРЕДНА ВЕРОЯТНОСТ";
            results.cssClass = "medium";
        } else {
            results.finalForecast = "НИСКА ВЕРОЯТНОСТ";
            results.cssClass = "low";
        }

        return results;
    }

    // Функция за показване на резултатите
    function renderResults(analysis) {
        resultsContainer.innerHTML = '';
        const sortedDates = Object.keys(analysis).sort();

        for (const date of sortedDates) {
            const result = analysis[date];
            const [year, month, day] = date.split('-');
            const formattedDate = `${day}.${month}.${year}`;

            const cardHTML = `
                <div class="forecast-card">
                    <h2>Прогноза за ${formattedDate}</h2>
                    <ul class="criteria-list">
                        <li>${result.criteria[0] ? '✅' : '❌'} <span>1. Слънчево небе:</span> ${result.details.clouds}</li>
                        <li>${result.criteria[1] ? '✅' : '❌'} <span>2. Темп. разлика:</span> ${result.details.temp}</li>
                        <li>${result.criteria[2] ? '✅' : '❌'} <span>3. Посока ENE/NE:</span> ${result.details.synoptic}</li>
                        <li>${result.criteria[3] ? '✅' : '❌'} <span>4. Без W/SW вятър:</span> ${result.details.opposing}</li>
                        <li>${result.criteria[4] ? '✅' : '❌'} <span>5. Ефект "засмукване":</span> ${result.details.suck_effect}</li>
                    </ul>
                    <div class="final-forecast ${result.cssClass}">
                        ${result.finalForecast}
                    </div>
                </div>
            `;
            resultsContainer.innerHTML += cardHTML;
        }
    }
});