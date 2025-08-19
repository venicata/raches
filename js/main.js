import { state } from './state.js';
import { translations } from './translations.js';
import { setLanguage, displayResults, initModal, initRecalibrateButton } from './ui.js';
import { fetchAndAnalyze, formatDate, triggerRealDataSync, getRealDataHistory, fetchAndDisplayRealWind } from './api.js';
import { renderHistoricalChart } from './chart.js';

document.addEventListener('DOMContentLoaded', async () => {
    state.resultsContainer = document.getElementById('results-container');

    // --- START: Language and Translations ---
    document.getElementById('lang-bg').addEventListener('click', () => setLanguage('bg'));
    document.getElementById('lang-en').addEventListener('click', () => setLanguage('en'));
    // --- END: Language and Translations ---

    // Calendar initialization
    state.datePicker = flatpickr("#date-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
        minDate: "today",
        maxDate: new Date().fp_incr(15) // Allows forecast up to 16 days ahead
    });

    // Automatically select today and next 2 days and fetch data
    const today = new Date();
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(today.getDate() + 2);

    state.datePicker.setDate([today, dayAfterTomorrow], true);

    const initialStartDate = formatDate(today);
    const initialEndDate = formatDate(dayAfterTomorrow);
    fetchAndAnalyze(initialStartDate, initialEndDate);

    const analyzeBtn = document.getElementById('analyze-btn');
    
    state.resultsContainer.innerHTML = `<p class="placeholder">${translations[state.currentLang].placeholderDefault}</p>`;

    analyzeBtn.addEventListener('click', () => {
        const selectedDates = state.datePicker.selectedDates;
        if (selectedDates.length < 2) {
            if (selectedDates.length === 1) {
                state.datePicker.setDate([selectedDates[0], selectedDates[0]], true);
            } else {
                alert("Моля, изберете период от дати.");
                return;
            }
        }
        
        const startDate = formatDate(state.datePicker.selectedDates[0]);
        const endDate = formatDate(state.datePicker.selectedDates[1]);
        
        fetchAndAnalyze(startDate, endDate);
    });

    // Modal functionality
    initModal();

    // Function to handle remote loading via URL parameter
    async function handleRemoteLoad() {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('load-remotely')) {
            console.log("Remote load triggered. Fetching forecast for the next 7 days. Please wait...");

            const analyzeBtn = document.getElementById('analyze-btn');
            if (analyzeBtn) analyzeBtn.disabled = true;

            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(startDate.getDate() + 3);

            try {
                await fetchAndAnalyze(startDate, endDate);
                console.log("Remote load process completed successfully.");
            } catch (error) {
                console.error("Error during remote load process:", error);
            } finally {
                if (analyzeBtn) analyzeBtn.disabled = false;
            }
        }
    }

    // Handle remote loading first if the URL parameter is present
    await handleRemoteLoad();

    // Set initial language and render chart on load
    const preferredLang = localStorage.getItem('preferredLang') || 'en';
    setLanguage(preferredLang);
    initRecalibrateButton();
    renderHistoricalChart();

    const syncBtn = document.getElementById('sync-btn');
    syncBtn.addEventListener('click', async () => {
        const T = translations[state.currentLang];
        const originalText = T.syncBtn || 'Сравни с реални данни';
        
        syncBtn.textContent = T.syncing || 'Синхронизиране...';
        syncBtn.disabled = true;

        try {
            // Стъпка 1: Задействаме обработката на сървъра
            await triggerRealDataSync();

            // Стъпка 2: Изтегляме обработените данни
            await fetchAndDisplayRealWind();
        } catch (error) {
            console.error("Грешка при синхронизация и показване на реални данни:", error);
            alert(T.syncError || "Възникна грешка при синхронизацията.");
        } finally {
            syncBtn.textContent = originalText;
            syncBtn.disabled = false;
        }
    });


});



