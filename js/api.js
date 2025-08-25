import { RACHES_LAT, RACHES_LON, VOLOS_LAT, VOLOS_LON } from './constants.js';
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
    state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderLoading}</p>`;

    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RACHES_LAT}&longitude=${RACHES_LON}&hourly=temperature_2m,cloud_cover_low,windspeed_10m,winddirection_80m,precipitation_probability,relative_humidity_2m,surface_pressure&daily=cloud_cover_mean,temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&start_date=${formattedStartDate}&end_date=${formattedEndDate}`;
    const marineApiUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${VOLOS_LAT}&longitude=${VOLOS_LON}&hourly=sea_surface_temperature&start_date=${formattedStartDate}&end_date=${formattedEndDate}&timezone=auto`;

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
        const correctionModel = await getCorrectionModel();

        const [{ predictedPeakTime }, analysisResults] = await Promise.all([
            getAppData(),
            processWeatherData(weatherData, marineData, correctionModel)
        ]);

        displayResults(analysisResults, predictedPeakTime);
        await fetchAndDisplayRealWind();
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
                'Content-Type': 'application/json'
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
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error("Failed to save historical entry to API:", response.status, response.statusText, errorData);
        } else {
            console.log("Historical entry saved successfully via API.");
        }
    } catch (error) {
        console.error("Error sending historical entry to API:", error);
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
        const response = await fetch('/api/predict-peak-wind-time', { method: 'POST' });
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
