import { translations } from './translations.js';
import { state } from './state.js';
import { getCloudCoverScore, getTempDiffScore, getWindSpeedScore, getWindDirectionScore, calculateAfternoonWindDirection, getWindDirIcon, getSuckEffectIcon } from './scoring-helpers.js';
import { predictWindSpeedRange, parsePredictedWindRange } from './wind-prediction.js';




export async function processWeatherData(weatherData, marineData, correctionModel = {}) {
    const dailyData = {};
    weatherData.daily.time.forEach((date, index) => {
        dailyData[date] = {
            cloud_cover: weatherData.daily.cloud_cover_mean[index],
            temperature_2m_max: weatherData.daily.temperature_2m_max[index],
            wind_speed_10m_max: weatherData.daily.wind_speed_10m_max[index],
            wind_direction_10m_dominant: weatherData.daily.wind_direction_10m_dominant[index],
            sea_temp: undefined,
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
    if (lastKnownSeaTemp === null) lastKnownSeaTemp = 26.0;

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
    const T = translations[state.currentLang];

    for (const date in dailyData) {
        const data = dailyData[date];
        let score = 0;

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
                    if (entryHour >= 9 && entryHour <= 11) {
                        if (morningWindSpeed === null || hourlyWindSpeeds[i] > morningWindSpeed) {
                            morningWindSpeed = hourlyWindSpeeds[i];
                        }
                    }
                    if (entryHour >= 15 && entryHour <= 17) {
                        if (afternoonWindSpeed === null || hourlyWindSpeeds[i] > afternoonWindSpeed) {
                            afternoonWindSpeed = hourlyWindSpeeds[i];
                        }
                    }
                }
            }
        }
        if (morningWindSpeed !== null && afternoonWindSpeed !== null) {
            const windIncreaseKmh = afternoonWindSpeed - morningWindSpeed;
            if (windIncreaseKmh >= 15) { suckEffectScore = 1.5; }
            else if (windIncreaseKmh >= 10) { suckEffectScore = 1; }
            else if (windIncreaseKmh >= 5) { suckEffectScore = 0.5; }
        }
        score += suckEffectScore;
        data.suck_effect_score_value = suckEffectScore;

        // Calculate daytime cloud cover average (5 AM to 4 PM)
        let daytimeCloudCoverSum = 0;
        let daytimeHourCount = 0;
        if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.cloud_cover_low) {
            weatherData.hourly.time.forEach((datetime, index) => {
                const entryDate = datetime.split('T')[0];
                if (entryDate === date) {
                    const hour = parseInt(datetime.split('T')[1].split(':')[0]);
                    if (hour >= 5 && hour <= 16) {
                        daytimeCloudCoverSum += weatherData.hourly.cloud_cover_low[index];
                        daytimeHourCount++;
                    }
                }
            });
        }

        const daytimeCloudCoverAvg = daytimeHourCount > 0 ? daytimeCloudCoverSum / daytimeHourCount : data.cloud_cover_mean; // Fallback to daily mean

        const cloudCoverResult = getCloudCoverScore(daytimeCloudCoverAvg);
        score += cloudCoverResult.score;
        data.cloud_cover_score = cloudCoverResult.score;
        data.cloud_cover_value = Math.round(daytimeCloudCoverAvg);

        data.air_temp_value = data.temperature_2m_max;
        data.sea_temp_value = data.sea_temp;
        const tempDiff = data.air_temp_value - data.sea_temp_value;
        data.temp_diff_value = tempDiff;
        const tempDiffResult = getTempDiffScore(tempDiff);
        score += tempDiffResult.score;
        data.temp_diff_score = tempDiffResult.score;
        data.temp_diff_description = T[tempDiffResult.textKey] || tempDiffResult.textKey;

        data.wind_speed_value = data.wind_speed_10m_max;
        const windSpeedResult = getWindSpeedScore(data.wind_speed_value);
        score += windSpeedResult.score;
        data.wind_speed_score = windSpeedResult.score;
        data.wind_speed_icon = windSpeedResult.icon;

        // Calculate and set wind direction
        const afternoonDir = calculateAfternoonWindDirection(weatherData, date);
        data.wind_direction_value = afternoonDir !== null ? afternoonDir : Math.round(data.wind_direction_10m_dominant);

        const windDirectionResult = getWindDirectionScore(data.wind_direction_value, T);
        score += windDirectionResult.score;
        data.wind_direction_score = windDirectionResult.score;
        data.wind_direction_description = windDirectionResult.description;

        data.score = score;
        const minScoreTotal = -13.5;
        const maxScoreTotal = 18.25;
        data.scoreText = T.scoreLabel.replace('{score}', score.toFixed(2)).replace('{minScore}', minScoreTotal).replace('{maxScore}', maxScoreTotal);

        if (score > 10) { data.forecastLabel = T.forecastHigh; }
        else if (score >= 5) { data.forecastLabel = T.forecastMid; }
        else if (score >= 0) { data.forecastLabel = T.forecastLow; }
        else { data.forecastLabel = T.forecastBad; }

        const scores = {
            overallScore: score,
            cloud_cover_score: data.cloud_cover_score,
            temp_diff_score: data.temp_diff_score,
            wind_speed_score: data.wind_speed_score,
            wind_direction_score: data.wind_direction_score,
            suck_effect_score_value: data.suck_effect_score_value
        };

        const windPrediction = predictWindSpeedRange(scores, correctionModel);

        data.pKnots_min = windPrediction.pKnots_min;
        data.pKnots_max = windPrediction.pKnots_max;
        data.pMs_min = windPrediction.avgPredictedMs; // Note: using avg for min/max ms for simplicity
        data.pMs_max = windPrediction.avgPredictedMs;
        data.predicted_wind_knots = `${windPrediction.pKnots_min}-${windPrediction.pKnots_max}`;
        data.predicted_wind_ms = `${(windPrediction.pKnots_min * 0.5144).toFixed(1)}-${(windPrediction.pKnots_max * 0.5144).toFixed(1)}`;
        data.predicted_wind_text = windPrediction.text;

        const KITING_MIN_KNOTS = 16;
        if (data.pKnots_max > 0 && data.pKnots_max < KITING_MIN_KNOTS) {
            data.forecastLabel = T.forecastNotSuitableKiting;
        }

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
            temp_diff_description: data.temp_diff_description,
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
            pKnots_min: data.pKnots_min,
            pKnots_max: data.pKnots_max,
            pMs_min: data.pMs_min,
            pMs_max: data.pMs_max,
            avgPredictedKnots: windPrediction.avgPredictedKnots, // Corrected value
            rawAvgPredictedKnots: windPrediction.rawAvgPredictedKnots, // Raw value
            waterTemp: data.sea_temp_value
        });
    }
    return analysisResults;
}
