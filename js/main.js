import { state } from './state.js';
import { translations } from './translations.js';
import { setLanguage, displayResults, initModal, initRecalibrateButton } from './ui.js';
import { fetchAndAnalyze, formatDate, triggerRealDataSync, fetchAndDisplayRealWind, triggerNightlyTasks } from './api.js';
import { renderHistoricalChart, renderRealWindChart } from './chart.js';

// Hide tooltips when clicking anywhere else on the page
document.addEventListener('click', () => {
    document.querySelectorAll('.result-card ul li.show-tooltip').forEach(item => {
        item.classList.remove('show-tooltip');
    });
});

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
        minDate: new Date().fp_incr(-1), // Allow selecting yesterday
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

    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('admin') === 'true') {
        document.querySelectorAll('.private-controls').forEach(el => el.classList.remove('private-controls'));
    }

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
    // Real wind chart view toggle
    const dailyBtn = document.getElementById('real-wind-daily-btn');
    const realWindWeeklyBtn = document.getElementById('real-wind-weekly-btn');
    const realWindMonthlyBtn = document.getElementById('real-wind-monthly-btn');

    const historicalDailyBtn = document.getElementById('historical-daily-btn');
    const historicalWeeklyBtn = document.getElementById('historical-weekly-btn');
    const historicalMonthlyBtn = document.getElementById('historical-monthly-btn');

    const historicalBtns = { daily: historicalDailyBtn, weekly: historicalWeeklyBtn, monthly: historicalMonthlyBtn };
    Object.entries(historicalBtns).forEach(([view, btn]) => {

        console.log(view, btn);

        btn.addEventListener('click', () => {
            if (state.historicalChartView === view) return;
            state.historicalChartView = view;
            Object.values(historicalBtns).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            renderHistoricalChart();
        });
    });

    dailyBtn.addEventListener('click', () => {
        if (state.realWindChartView === 'daily') return; // Do nothing if already active
        state.realWindChartView = 'daily';
        dailyBtn.classList.add('active');
        realWindWeeklyBtn.classList.remove('active');
        realWindMonthlyBtn.classList.remove('active');
        renderRealWindChart();
    });

    realWindWeeklyBtn.addEventListener('click', () => {
        if (state.realWindChartView === 'weekly') return; // Do nothing if already active
        state.realWindChartView = 'weekly';
        realWindWeeklyBtn.classList.add('active');
        dailyBtn.classList.remove('active');
        realWindMonthlyBtn.classList.remove('active');
        renderRealWindChart();
    });

    realWindMonthlyBtn.addEventListener('click', () => {
        state.realWindChartView = 'monthly';
        document.querySelectorAll('.chart-controls button').forEach(btn => btn.classList.remove('active'));
        realWindMonthlyBtn.classList.add('active');
        renderRealWindChart();
    });

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

    const refreshBtn = document.getElementById('refreshBtn');
    refreshBtn.addEventListener('click', async () => {
        const statusSpan = document.getElementById('recalibrateStatus');
        statusSpan.textContent = 'Refreshing data...';
        refreshBtn.disabled = true;

        try {
            const result = await triggerNightlyTasks();
            statusSpan.textContent = result.message || 'Data refreshed successfully!';
            alert('Success: ' + (result.message || 'Data refreshed successfully!'));
        } catch (error) {
            console.error('Failed to refresh data:', error);
            statusSpan.textContent = `Error: ${error.message}`;
            alert(`Error: ${error.message}`);
        } finally {
            refreshBtn.disabled = false;
        }
    });
});



