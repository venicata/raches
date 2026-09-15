import { state } from './state.js';
import { translations } from './translations.js';
import { setLanguage, displayResults, initModal, initAdminButtons, initAdminLogin, initSettingsModal } from './ui.js';
import { fetchAndAnalyze, formatDate, triggerRealDataSync, fetchAndDisplayRealWind, triggerNightlyTasks, trainPeakTimeModel } from './api.js';
import { renderHistoricalChart, renderRealWindChart } from './chart.js';
import { initThemeToggle } from './theme.js';

// Parses a 'YYYY-MM-DD' URL param into a local Date, avoiding UTC-parsing
// timezone shifts (new Date('YYYY-MM-DD') parses as UTC midnight).
function parseDateFromParam(str) {
    if (!str || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
    const [year, month, day] = str.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return isNaN(d.getTime()) ? null : d;
}

// Reflects the currently analyzed date range in the URL so the page can be
// shared and reopened with the same forecast dates preselected.
function updateUrlWithDates(startDate, endDate) {
    const url = new URL(window.location.href);
    url.searchParams.set('start', startDate);
    url.searchParams.set('end', endDate);
    window.history.replaceState({}, '', url);
}

// Hide tooltips when clicking anywhere else on the page
document.addEventListener('click', () => {
    document.querySelectorAll('.result-card ul li.show-tooltip').forEach(item => {
        item.classList.remove('show-tooltip');
    });
});

document.addEventListener('DOMContentLoaded', async () => {
    // Set up dark/light/auto theme before any chart is created so Chart.js
    // picks up the right default text/grid colors from the very first render.
    initThemeToggle();

    state.resultsContainer = document.getElementById('results-container');

    // Restore admin session (password stored after a successful admin-login modal submit)
    const storedAdminKey = localStorage.getItem('adminKey');
    if (storedAdminKey) {
        document.querySelectorAll('.private-controls').forEach(el => el.classList.remove('private-controls'));
        state.isAdmin = true;
        state.adminKey = storedAdminKey;
    }
    initAdminLogin();

    // --- START: Language and Translations ---
    document.getElementById('lang-bg').addEventListener('click', () => setLanguage('bg'));
    document.getElementById('lang-en').addEventListener('click', () => setLanguage('en'));
    // --- END: Language and Translations ---

    // Calendar initialization
    state.datePicker = flatpickr("#date-picker", {
        mode: "range",
        dateFormat: "Y-m-d",
        minDate: new Date().fp_incr(-15), // Allow selecting yesterday
        maxDate: new Date().fp_incr(15) // Allows forecast up to 16 days ahead
    });

    // Restore dates from the URL if present (e.g. a shared link); otherwise
    // default to today and the next 2 days.
    const urlParams = new URLSearchParams(window.location.search);
    const urlStartDate = parseDateFromParam(urlParams.get('start'));
    const urlEndDate = parseDateFromParam(urlParams.get('end'));

    const today = new Date();
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(today.getDate() + 2);

    const initialRangeStart = urlStartDate || today;
    const initialRangeEnd = urlEndDate || dayAfterTomorrow;

    state.datePicker.setDate([initialRangeStart, initialRangeEnd], true);

    const initialStartDate = formatDate(initialRangeStart);
    const initialEndDate = formatDate(initialRangeEnd);
    fetchAndAnalyze(initialStartDate, initialEndDate);
    updateUrlWithDates(initialStartDate, initialEndDate);

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
        updateUrlWithDates(startDate, endDate);
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
    const historicalAllBtn = document.getElementById('historical-all-btn');

    const historicalBtns = { daily: historicalDailyBtn, weekly: historicalWeeklyBtn, monthly: historicalMonthlyBtn, all: historicalAllBtn };
    Object.entries(historicalBtns).forEach(([view, btn]) => {
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

    initAdminButtons();
    initSettingsModal();
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
        statusSpan.style.color = 'var(--color-text-muted)';
        refreshBtn.disabled = true;

        try {
            const result = await triggerNightlyTasks();
            statusSpan.textContent = result.message || 'Data refreshed successfully!';
            statusSpan.style.color = 'var(--color-high)';
        } catch (error) {
            console.error('Failed to refresh data:', error);
            statusSpan.textContent = `Error: ${error.message}`;
            statusSpan.style.color = 'var(--color-bad)';
        } finally {
            refreshBtn.disabled = false;
        }
    });

    const trainPeakTimeModelBtn = document.getElementById('trainPeakTimeModelBtn');
    trainPeakTimeModelBtn.addEventListener('click', async () => {
        const T = translations[state.currentLang];
        const statusSpan = document.getElementById('recalibrateStatus');
        const originalText = trainPeakTimeModelBtn.textContent;
        trainPeakTimeModelBtn.textContent = T.trainingModel || 'Обучение...';
        trainPeakTimeModelBtn.disabled = true;
        statusSpan.textContent = 'Обучение на модела...';
        statusSpan.style.color = 'var(--color-text-muted)';

        try {
            const result = await trainPeakTimeModel();
            statusSpan.textContent = result.message || 'Моделът е обучен успешно!';
            statusSpan.style.color = 'var(--color-high)';
        } catch (error) {
            console.error('Failed to train peak time model:', error);
            statusSpan.textContent = `Грешка при обучение на модела: ${error.message}`;
            statusSpan.style.color = 'var(--color-bad)';
        } finally {
            trainPeakTimeModelBtn.textContent = originalText;
            trainPeakTimeModelBtn.disabled = false;
        }
    });
});
