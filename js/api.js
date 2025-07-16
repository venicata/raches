import { RACHES_LAT, RACHES_LON, VOLOS_LAT, VOLOS_LON } from './constants.js';
import { processWeatherData } from './scoring.js';
import { displayResults } from './ui.js';
import { translations } from './translations.js';
import { state } from './state.js';

export function formatDate(date) {
    const d = new Date(date),
            year = d.getFullYear(),
            month = ('0' + (d.getMonth() + 1)).slice(-2),
            day = ('0' + d.getDate()).slice(-2);
    return [year, month, day].join('-');
}

export async function fetchAndAnalyze(startDate, endDate) {
    state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderLoading}</p>`;
    
    const formattedStartDate = formatDate(startDate);
    const formattedEndDate = formatDate(endDate);

    const weatherApiUrl = `https://api.open-meteo.com/v1/forecast?latitude=${RACHES_LAT}&longitude=${RACHES_LON}&hourly=temperature_2m,cloudcover,windspeed_10m,winddirection_80m&daily=cloud_cover_mean,temperature_2m_max,wind_speed_10m_max,wind_direction_10m_dominant&timezone=auto&start_date=${formattedStartDate}&end_date=${formattedEndDate}`;
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

        const analysisResults = await processWeatherData(weatherData, marineData);
        displayResults(analysisResults);
    } catch (error) {
        state.resultsContainer.innerHTML = `<p class="placeholder" style="color: red;">Грешка: ${error.message}</p>`;
    }
}

export async function getHistoricalData() {
    try {
        const response = await fetch('/api/getHistory');
        if (!response.ok) {
            console.error("Failed to fetch historical data from API:", response.status, response.statusText);
            return []; 
        }
        const data = await response.json();
        return data && Array.isArray(data) ? data : [];
    } catch (error) {
        console.error("Error fetching or parsing historical data from API:", error);
        return [];
    }
}

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
