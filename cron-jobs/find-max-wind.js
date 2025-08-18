// Файл: /Users/venelinvenelinov/Projects/raches/cron-jobs/find-max-wind.js

// Този скрипт е предназначен да се изпълнява от крон джоб.
// Той изтегля данни за метеорологични наблюдения, намира записа с най-висока скорост на вятъра за деня
// и го запазва в базата данни за целите на калибрирането.

// Забележка: Node.js v18+ е необходим за 'fetch' без допълнителни пакети.
const API_URL = 'https://kiting.live/api/observations/history-5m';
const API_KEY = 'e1f10a1e78da46f5b10a1e78da96f525'; // ВАЖНО: За по-добра сигурност, преместете ключа в environment променлива.
const CLIENT_USERNAME = 'veniaminikus@gmail.com';

/**
 * Изтегля историческите данни от API-то на kiting.live.
 */
async function fetchHistoricalData() {
    console.log('Изтегляне на исторически данни...');
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'api-key': API_KEY,
                'X-Client-Username': CLIENT_USERNAME,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`API заявката неуспешна със статус ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`Успешно изтеглени ${data.length} записа.`);
        return data;
    } catch (error) {
        console.error('Грешка при изтегляне на исторически данни:', error);
        process.exit(1); // Прекратява изпълнението с код за грешка
    }
}

/**
 * Намира записа с максимална скорост на вятъра.
 * @param {Array<Object>} observations - Масив с обекти от API-то.
 * @returns {Object|null} Обектът с най-висока стойност на windSpeedKnots или null.
 */
function findMaxWindObservation(observations) {
    if (!observations || observations.length === 0) {
        console.log('Няма записи за обработка.');
        return null;
    }

    // Намиране на обекта с най-голяма стойност за windSpeedKnots
    const maxWindObservation = observations.reduce((max, current) => {
        // Проверяваме дали current и current.windSpeedKnots са валидни
        if (current && typeof current.windSpeedKnots === 'number') {
            return (current.windSpeedKnots > (max.windSpeedKnots || 0)) ? current : max;
        }
        return max;
    }, observations[0]); // Започваме с първия елемент като начален максимум

    console.log('Запис с най-висока скорост на вятъра:', maxWindObservation);
    return maxWindObservation;
}

/**
 * Запазва данните в базата данни, като извиква локален API endpoint.
 * @param {Object} dataToSave - Обектът, който трябва да бъде запазен.
 */
async function saveDataToDatabase(dataToSave) {
    // ВАЖНО: Трябва да създадете API endpoint (напр. /api/saveMaxWindRecord),
    // който да се грижи за логиката по записа в базата данни.
    // Това е по-сигурният подход, за да не разкривате данни за достъп до базата тук.
    const saveApiUrl = 'http://localhost:3000/api/saveMaxWindRecord'; // Променете URL и порта, ако е нужно.

    console.log(`Запазване на данни към ${saveApiUrl}...`);
    try {
        const response = await fetch(saveApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(dataToSave),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Грешка при запис в базата данни: ${response.status} ${response.statusText} - ${errorText}`);
        }

        console.log('Данните са запазени успешно.');
    } catch (error) {
        console.error(error);
        process.exit(1);
    }
}

/**
 * Основна функция на скрипта.
 */
async function main() {
    const observations = await fetchHistoricalData();
    const maxWindRecord = findMaxWindObservation(observations);

    if (maxWindRecord) {
        console.log('Най-силният вятър за деня е намерен. Сега ще бъде направен опит за запис.');
        // TODO: Разкоментирайте следния ред, след като създадете вашия API endpoint за запис.
        // await saveDataToDatabase(maxWindRecord);
    }
}

// Извикване на основната функция
main();
