import { translations } from './translations.js';
import { state } from './state.js';
import { getCloudCoverScore, getTempDiffScore, getWindDirectionScore, getWindDirIcon, getSuckEffectIcon } from './scoring-helpers.js';
import { predictWindSpeedRange, parsePredictedWindRange } from './wind-prediction.js';

// Helper function to calculate the average of a set of angles (wind directions)
function getAverageDirection(directions) {
    if (!directions || directions.length === 0) return 0;

    let sumSin = 0;
    let sumCos = 0;

    directions.forEach(dir => {
        const rad = dir * (Math.PI / 180);
        sumSin += Math.sin(rad);
        sumCos += Math.cos(rad);
    });

    const avgSin = sumSin / directions.length;
    const avgCos = sumCos / directions.length;

    const avgDirRad = Math.atan2(avgSin, avgCos);
    let avgDirDeg = avgDirRad * (180 / Math.PI);

    if (avgDirDeg < 0) {
        avgDirDeg += 360;
    }

    return avgDirDeg;
}

export async function processWeatherData(weatherData, marineData) {
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

        // Calculate daytime cloud cover average (6 AM to 9 PM)
        let daytimeCloudCoverSum = 0;
        let daytimeHourCount = 0;
        if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.cloudcover) {
            weatherData.hourly.time.forEach((datetime, index) => {
                const entryDate = datetime.split('T')[0];
                if (entryDate === date) {
                    const hour = parseInt(datetime.split('T')[1].split(':')[0]);
                    if (hour >= 6 && hour <= 17) {
                        daytimeCloudCoverSum += weatherData.hourly.cloudcover[index];
                        daytimeHourCount++;
                    }
                }
            });
        }

        const daytimeCloudCoverAvg = daytimeHourCount > 0 ? daytimeCloudCoverSum / daytimeHourCount : data.cloud_cover; // Fallback to daily mean

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
        data.temp_diff_description_key = tempDiffResult.textKey;

        data.wind_speed_value = data.wind_speed_10m_max;
        let windSpeedScore = 0;
        let windSpeedIcon = '';
        if (data.wind_speed_value >= 15 && data.wind_speed_value <= 30) { windSpeedScore = 3.5; windSpeedIcon = '✅'; }
        else if (data.wind_speed_value > 30 && data.wind_speed_value <= 40) { windSpeedScore = 2; windSpeedIcon = '⚠️'; }
        else if (data.wind_speed_value < 15 && data.wind_speed_value >= 5) { windSpeedScore = 1; windSpeedIcon = '❌'; }
        else if (data.wind_speed_value < 5) { windSpeedScore = 0; windSpeedIcon = '❌'; }
        else { windSpeedScore = -1; windSpeedIcon = '❌'; }
        score += windSpeedScore;
        data.wind_speed_score = windSpeedScore;
        data.wind_speed_icon = windSpeedIcon;

        // Calculate average wind direction for the thermal period (2 PM to 6 PM)
        const afternoonWindDirections = [];
        if (weatherData.hourly && weatherData.hourly.time && weatherData.hourly.winddirection_80m) {
            weatherData.hourly.time.forEach((datetime, index) => {
                const entryDate = datetime.split('T')[0];
                if (entryDate === date) {
                    const hour = parseInt(datetime.split('T')[1].split(':')[0]);
                    if (hour >= 13 && hour <= 17) { // Thermal wind window
                        afternoonWindDirections.push(weatherData.hourly.winddirection_80m[index]);
                    }
                }
            });
        }

        // Use the calculated afternoon average, or fallback to the daily dominant if no hourly data is available
        data.wind_direction_value = afternoonWindDirections.length > 0 
            ? Math.round(getAverageDirection(afternoonWindDirections)) 
            : Math.round(data.wind_direction_10m_dominant);
        let windDirectionScore = 0;
        let windDirDescKey = '';
        const dir = data.wind_direction_value;
        if (dir >= 45 && dir <= 90) { // NE-E (Ideal)
            windDirectionScore = 3;
            windDirDescKey = 'windDirNE_E_Ideal';
        }
        else if (dir >= 90 && dir <= 115) { // NE-E (almost Ideal)
            windDirectionScore = 1;
            windDirDescKey = 'windDirNE_E_Acceptable';
        }
        else if ((dir > 115 && dir <= 135) || (dir >= 0 && dir < 45)) { // E-SE and N-NE (Not good)
            windDirectionScore = -2;
            windDirDescKey = (dir > 90) ? 'windDirE_SE_Acceptable' : 'windDirN_NE_Acceptable';
        } else if (dir > 135 && dir < 225) { // SE-S-SW (Not good at all)
            windDirectionScore = -4;
            windDirDescKey = 'windDirSE_S_SW_Neutral';
        } else { // W, NW (Bad)
            windDirectionScore = -8;
            windDirDescKey = 'windDirW_NW_Bad';
        }
        score += windDirectionScore;
        data.wind_direction_score = windDirectionScore;
        data.wind_direction_description = T[windDirDescKey] || windDirDescKey;

        data.score = score;
        const minScoreTotal = -13.5;
        const maxScoreTotal = 18.25;
        data.scoreText = T.scoreLabel.replace('{score}', score.toFixed(2)).replace('{minScore}', minScoreTotal).replace('{maxScore}', maxScoreTotal);

        if (score > 10) { data.forecastLabel = T.forecastHigh; }
        else if (score >= 5) { data.forecastLabel = T.forecastMid; }
        else if (score >= 0) { data.forecastLabel = T.forecastLow; }
        else { data.forecastLabel = T.forecastBad; }

        const predictedWindText = predictWindSpeedRange(score);
        const parsedWind = parsePredictedWindRange(predictedWindText);
        data.predicted_wind_knots = parsedWind.knots;
        data.predicted_wind_ms = parsedWind.ms;

        const KITING_MIN_KNOTS = 16;
        if (data.predicted_wind_knots && data.predicted_wind_knots.max > 0 && data.predicted_wind_knots.max < KITING_MIN_KNOTS) {
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
