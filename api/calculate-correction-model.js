import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();

const FORECAST_HISTORY_KEY = 'rachesForecastHistory';
const REAL_WIND_HISTORY_KEY = 'max_wind_history';
const MODEL_KEY = 'prediction_model';

/**
 * Основната функция, която изчислява и запазва корекционния модел.
 */
export default async function handler(request, response) {
    // TODO: Add security check (e.g., cron secret)

    try {
        // 1. Извличане на данните
        const [forecastHistory, realWindHistory] = await Promise.all([
            redis.get(FORECAST_HISTORY_KEY) || [],
            redis.get(REAL_WIND_HISTORY_KEY) || []
        ]);

        if (forecastHistory.length === 0 || realWindHistory.length === 0) {
            return response.status(200).json({ message: 'Недостатъчно данни за генериране на модел.' });
        }

        // 2. Обединяване на данните по дата
        const realWindMap = new Map(realWindHistory.map(r => [r.timestamp.split('T')[0], r]));
        const combinedData = [];

        forecastHistory.forEach(forecast => {
            const realWind = realWindMap.get(forecast.date);
            if (realWind) {
                const predictedKnots = (forecast.pKnots_min + forecast.pKnots_max) / 2;
                const predictedSpread = forecast.pKnots_max - forecast.pKnots_min;
                combinedData.push({
                    date: forecast.date,
                    predictedKnots,
                    predictedSpread,
                    realKnots: realWind.windSpeedKnots,
                    // Добавяне на всички необходими фактори за анализ
                    temp_diff_value: forecast.temp_diff_value,
                    cloud_cover_value: forecast.cloud_cover_value,
                    suck_effect_score_value: forecast.suck_effect_score_value,
                    wind_speed_value: forecast.wind_speed_value,
                    wind_direction_value: forecast.wind_direction_value
                });
            }
        });

        if (combinedData.length < 3) { // Изискваме поне 3 дни с данни за по-голяма достоверност
             return response.status(200).json({ message: 'Недостатъчно съвпадащи данни за генериране на модел.' });
        }

        // 3. Изчисляване на сложен модел (v3) с корекция и мащабиране
        const deltas = combinedData.map(d => d.realKnots - d.predictedKnots);
        
        // Изчисляване на scalingFactor
        const averageSpread = combinedData.reduce((sum, d) => sum + d.predictedSpread, 0) / combinedData.length;
        const stdDevOfDeltas = Math.sqrt(deltas.map(x => Math.pow(x - (deltas.reduce((a, b) => a + b, 0) / deltas.length), 2)).reduce((a, b) => a + b, 0) / (deltas.length - 1));
        // Scaling factor-a трябва да е разумен, затова го ограничаваме.
        // Ако грешката (stdDev) е голяма, искаме да разширим спреда. Ако е малка, да го свием.
        // Целим stdDev да е около 1/4 от спреда. 
        const idealStdDev = averageSpread / 4;
        let scalingFactor = (stdDevOfDeltas && idealStdDev) ? stdDevOfDeltas / idealStdDev : 1;
        scalingFactor = Math.max(0.5, Math.min(1.5, scalingFactor)); // Ограничаване между 0.5x и 1.5x

        const model = {
            version: 3,
            scalingFactor: scalingFactor,
            lastUpdated: new Date().toISOString(),
            weights: {
                tempDiff: calculateCorrectionsForFactor(combinedData, deltas, 'temp_diff_value', val => {
                    if (val >= 6) return 'high';
                    if (val < 3) return 'low';
                    return 'medium';
                }),
                cloudCover: calculateCorrectionsForFactor(combinedData, deltas, 'cloud_cover_value', val => {
                    if (val <= 30) return 'low';
                    if (val > 70) return 'high';
                    return 'medium';
                }),
                suckEffect: calculateCorrectionsForFactor(combinedData, deltas, 'suck_effect_score_value', val => {
                    if (val >= 1) return 'high';
                    if (val < 0.5) return 'low';
                    return 'medium';
                }),
                windSpeed: calculateCorrectionsForFactor(combinedData, deltas, 'wind_speed_value', val => {
                    if (val >= 30) return 'high'; // km/h
                    if (val < 15) return 'low';
                    return 'medium';
                }),
                windDirection: calculateCorrectionsForFactor(combinedData, deltas, 'wind_direction_value', val => {
                    if (val >= 45 && val <= 115) return 'ideal'; // NE-E
                    if (val > 115 && val < 225) return 'bad'; // SE-S-SW
                    return 'other';
                })
            }
        };

        // 4. Запазване на новия модел в Redis
        await redis.set(MODEL_KEY, JSON.stringify(model));

        response.status(200).json({
            success: true,
            message: `Моделът е изчислен и запазен успешно.`,
            model: model,
            recordsAnalyzed: combinedData.length
        });

    } catch (error) {
        console.error('Грешка при изчисляване на корекционния модел:', error);
        response.status(500).json({ success: false, error: error.message });
    }
}

/**
 * Изчислява корекционни коефициенти за даден фактор чрез групиране.
 * @param {Array} data - Обединените данни.
 * @param {Array} deltas - Масив с грешките за всеки запис.
 * @param {String} factorKey - Ключът на фактора, който да се анализира (напр. 'temp_diff_value').
 * @returns {Object} - Обект с корекциите.
 */
function calculateCorrectionsForFactor(data, deltas, factorKey, groupingLogic) {
    const factorCorrections = {};
    const groups = {}; // e.g., { 'high': [ {delta: 1.2}, {delta: -0.5} ] }

    // Групиране на делтите по стойността на фактора
    data.forEach((entry, index) => {
        const factorValue = entry[factorKey];
        const groupName = groupingLogic(factorValue);

        if (!groups[groupName]) {
            groups[groupName] = [];
        }
        groups[groupName].push(deltas[index]);
    });

    // Изчисляване на средната делта за всяка група
    for (const groupName in groups) {
        const groupDeltas = groups[groupName];
        const averageDelta = groupDeltas.reduce((sum, d) => sum + d, 0) / groupDeltas.length;
        // Запазваме средната корекция, която трябва да се приложи
        factorCorrections[groupName] = averageDelta;
    }

    return factorCorrections;
}
