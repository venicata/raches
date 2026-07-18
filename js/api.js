import { RACHES_LAT, RACHES_LON, SEA_TEMP_LAT, SEA_TEMP_LON, LAMIA_LAT, LAMIA_LON } from './constants.js';
import { processWeatherData } from './scoring.js';
import { displayResults, displayRealWindData } from './ui.js';
import { translations } from './translations.js';
import { state } from './state.js';
import { renderHistoricalChart, renderRealWindChart } from './chart.js';

/**
 * Formats a date string into the format 'YYYY-MM-DD'.
 * @param {string} date - The date string to format.
 * @returns {string} The formatted date string.
 */
export function formatDate(date) {
    const d = new Date(date),
        year = d.getFullYear(),
        month = ('0' + (d.getMonth() + 1)).slice(-2),
        day = ('0' + d.getDate()).slice(-2);
    return [year, month, day].join('-');
}

/**
 * Fetches weather and marine data from the API, processes it, and displays the results.
 * @param {string} startDate - The start date for the data.
 * @param {string} endDate - The end date for the data.
 */
export async function fetchAndAnalyze(startDate, endDate) {
    state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderLoading}</p>`;

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    // URL for Raches - wind and other parameters
    // Added: wind_speed_80m (kite-height wind), wind_direction_10m, temperature_180m (lapse rate),
    //        vapour_pressure_deficit (thermal potential), soil_temperature_0cm (land heating)
    // wind_speed_80m_max is NOT a valid daily param in Open Meteo — compute daily max from hourly wind_speed_80m in scoring
    const rachesWeatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RACHES_LAT}&longitude=${RACHES_LON}&hourly=windspeed_10m,wind_speed_80m,winddirection_80m,wind_direction_10m,precipitation_probability,relative_humidity_2m,surface_pressure,rain,temperature_2m,temperature_180m,vapour_pressure_deficit,soil_temperature_0cm&daily=wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&start_date=${formattedStartDate}&end_date=${formattedEndDate}`;

    // URL for Lamia - temperature and cloud cover
    // Added: cloud_cover_low, cloud_cover_mid, cloud_cover_high (stratified cloud analysis)
    const lamiaWeatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${LAMIA_LAT}&longitude=${LAMIA_LON}&hourly=temperature_2m,cloud_cover,cloud_cover_low,cloud_cover_mid,cloud_cover_high&daily=cloud_cover_mean,temperature_2m_max&timezone=auto&start_date=${formattedStartDate}&end_date=${formattedEndDate}`;

    // URL for Volos - sea temperature
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${SEA_TEMP_LAT}&longitude=${SEA_TEMP_LON}&hourly=sea_surface_temperature&start_date=${formattedStartDate}&end_date=${formattedEndDate}&timezone=auto`;

    try {
        const [rachesWeatherResponse, lamiaWeatherResponse, marineResponse] = await Promise.all([
            fetch(rachesWeatherApiUrl),
            fetch(lamiaWeatherApiUrl),
            fetch(marineApiUrl)
        ]);

        if (!rachesWeatherResponse.ok || !lamiaWeatherResponse.ok || !marineResponse.ok) {
            throw new Error('Проблем при връзката с API-то за времето.');
        }

        const rachesWeatherData = await rachesWeatherResponse.json();
        const lamiaWeatherData = await lamiaWeatherResponse.json();
        const marineData = await marineResponse.json();

        // Merge weather data — Raches for wind/pressure/VPD, Lamia for temperature/cloud
        const weatherData = {
            ...rachesWeatherData,
            hourly: {
                ...rachesWeatherData.hourly,
                // Lamia temperature (used for land-sea temp diff)
                temperature_2m: lamiaWeatherData.hourly.temperature_2m,
                // Cloud cover: use Lamia total as primary, plus stratified layers from Lamia
                cloud_cover_low: lamiaWeatherData.hourly.cloud_cover_low,
                cloud_cover_mid: lamiaWeatherData.hourly.cloud_cover_mid,
                cloud_cover_high: lamiaWeatherData.hourly.cloud_cover_high,
                cloud_cover_total: lamiaWeatherData.hourly.cloud_cover,
            },
            daily: {
                ...rachesWeatherData.daily,
                cloud_cover_mean: lamiaWeatherData.daily.cloud_cover_mean,
                temperature_2m_max: lamiaWeatherData.daily.temperature_2m_max,
            }
        };

        const correctionModel = await getCorrectionModel();

        const [{ peakWindModel, maxWindHistory }, analysisResults] = await Promise.all([
            getAppData(),
            processWeatherData(weatherData, marineData, correctionModel)
        ]);

        displayResults(analysisResults, maxWindHistory, peakWindModel, correctionModel);
    } catch (error) {
        state.resultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Грешка: ${error.message}</p>`;
    }
}

/**
 * Fetches the real wind history from the server and calls the display function.
 */
export async function fetchAndDisplayRealWind() {
    try {
        const { maxWindHistory: history } = await getAppData();
        if (history && history.length > 0) {
            displayRealWindData(history);
        } else {
            console.log('No historical wind data available to display.');
        }
    } catch (error) {
        console.error('Error fetching or displaying real wind data:', error);
        // Do not show an alert here, as this is a background process
    }
}

/**
 * Triggers the real data sync process.
 */
export async function triggerRealDataSync() {
    try {
        const response = await fetch('/api/process-max-wind', {
            method: 'POST', // Използваме POST, за да е ясно, че задействаме процес
            headers: { 'x-admin-key': state.adminKey || '' }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error("Failed to trigger real data sync:", response.status, response.statusText, errorData);
            return null;
        }
        return response.json();
    } catch (error) {
        console.error("Error triggering real data sync:", error);
        return null;
    }
}

/**
 * Fetches the correction model from the server.
 */
export async function getCorrectionModel() {
    try {
        const response = await fetch('/api/get-correction-model');
        if (!response.ok) {
            console.error("Failed to fetch correction model:", response.status, response.statusText);
            return {}; // Връщаме празен обект при грешка, за да не чупим логиката
        }
        return response.json();
    } catch (error) {
        console.error("Error fetching correction model:", error);
        return {};
    }
}

/**
 * Triggers the model calculation process.
 */
export async function triggerModelCalculation() {
    try {
        const response = await fetch('/api/calculate-correction-model', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-key': state.adminKey || ''
            }
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error("Failed to trigger model calculation:", response.status, response.statusText, errorData);
            // Rethrow to be caught by the caller
            throw new Error(errorData.error || 'Failed to trigger model calculation');
        }
        return response.json();
    } catch (error) {
        console.error("Error triggering model calculation:", error);
        throw error; // Rethrow to be caught by the caller
    }
}

/**
 * Fetches the application data from the server.
 */
export async function getAppData() {
    try {
        const response = await fetch('/api/get-app-data');
        if (!response.ok) {
            console.error("Failed to fetch app data:", response.status, response.statusText);
            return { forecastHistory: [], maxWindHistory: [] };
        }
        const data = await response.json();
        state.historicalForecastData = data.forecastHistory || [];
        state.realWindHistory = (data.maxWindHistory || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        renderHistoricalChart(); // Render the main chart
        renderRealWindChart(); // Render the new real wind chart
        return data;
    } catch (error) {
        console.error("Error fetching app data:", error);
        return { forecastHistory: [], maxWindHistory: [] };
    }
}

/**
 * Saves a historical entry to the server.
 * @param {object} entry - The historical entry to save.
 */
export async function saveHistoricalEntry(entry) {
    if (!entry || !entry.date) {
        console.error("Invalid entry for historical data (client-side check):", entry);
        return;
    }
    try {
        const response = await fetch('/api/saveHistory', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(entry),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
    } catch (error) {
        console.error('Failed to save historical entry:', error);
    }
}

/**
 * Triggers the nightly tasks process.
 */
export async function triggerNightlyTasks() {
    try {
        const response = await fetch('/api/run-nightly-tasks', {
            method: 'GET'
        });
        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error || `HTTP error! status: ${response.status}`);
        }
        state.historicalForecastData = data.forecastHistory || [];
        state.realWindHistory = (data.maxWindHistory || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        renderHistoricalChart(); // Render the main chart
        renderRealWindChart(); // Render the new real wind chart
        return data;
    } catch (error) {
        console.error("Error triggering nightly tasks:", error);
        throw error;
    }
}

/**
 * Triggers the training of the peak wind time model on the server.
 */
export async function trainPeakTimeModel() {
    try {
        const response = await fetch('/api/predict-peak-wind-time', {
            method: 'POST',
            headers: { 'x-admin-key': state.adminKey || '' }
        });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to train peak time model');
        }
        return await response.json();
    } catch (error) {
        console.error("Error triggering peak time model training:", error);
        throw error; // Rethrow to be caught by the caller
    }
}

/**
 * Deletes the real wind record for a specific date (e.g. when the station reading is bugged).
 * @param {string} date - The date (YYYY-MM-DD) whose real wind record should be removed.
 */
export async function deleteRealWindForDate(date) {
    const response = await fetch('/api/delete-real-wind-by-date', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-admin-key': state.adminKey || ''
        },
        body: JSON.stringify({ date })
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Failed to delete real wind data');
    }
    return result;
}

/**
 * Verifies the admin password against the server and returns whether it was correct.
 * @param {string} password
 */
export async function adminLogin(password) {
    const response = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
    });
    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.error || 'Грешна парола');
    }
    return result;
}
