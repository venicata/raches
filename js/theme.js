import { state } from './state.js';

const STORAGE_KEY = 'themeMode'; // 'light' | 'dark' | 'auto'
const MODES = ['light', 'dark', 'auto'];
const ICONS = { light: '☀️', dark: '🌙', auto: '🌓' };
const LABELS = {
    bg: { light: 'Дневна', dark: 'Нощна', auto: 'Авто' },
    en: { light: 'Light', dark: 'Dark', auto: 'Auto' }
};

const CHART_COLORS = {
    light: { text: '#64748b', grid: '#e4e9f0' },
    dark:  { text: '#94a3b8', grid: '#334155' }
};

const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

let currentMode = MODES.includes(localStorage.getItem(STORAGE_KEY)) ? localStorage.getItem(STORAGE_KEY) : 'auto';

function resolveEffectiveTheme(mode) {
    return mode === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : mode;
}

function updateChartDefaults(effectiveTheme) {
    if (typeof Chart === 'undefined') return;
    const colors = CHART_COLORS[effectiveTheme];
    Chart.defaults.color = colors.text;
    Chart.defaults.borderColor = colors.grid;
}

function updateToggleButton(mode) {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const icon = btn.querySelector('.theme-toggle-icon');
    const T = LABELS[state.currentLang] || LABELS.en;
    if (icon) icon.textContent = ICONS[mode];
    btn.title = T[mode];
    btn.setAttribute('aria-label', T[mode]);
    btn.dataset.mode = mode;
}

function applyTheme(rerenderCharts) {
    const effectiveTheme = resolveEffectiveTheme(currentMode);
    document.documentElement.setAttribute('data-theme', effectiveTheme);
    updateChartDefaults(effectiveTheme);
    updateToggleButton(currentMode);

    if (rerenderCharts) {
        import('./chart.js').then(({ renderHistoricalChart, renderRealWindChart }) => {
            if (state.historicalChartInstance) renderHistoricalChart();
            if (state.realWindChartInstance) renderRealWindChart();
        });
    }
}

export function initThemeToggle() {
    // Apply immediately (no rerender needed yet - no charts exist at this point).
    applyTheme(false);

    const btn = document.getElementById('theme-toggle');
    if (btn) {
        btn.addEventListener('click', () => {
            const idx = MODES.indexOf(currentMode);
            currentMode = MODES[(idx + 1) % MODES.length];
            localStorage.setItem(STORAGE_KEY, currentMode);
            applyTheme(true);
        });
    }

    mediaQuery.addEventListener('change', () => {
        if (currentMode === 'auto') {
            applyTheme(true);
        }
    });
}

// Called after the UI language changes so the button's title/aria-label stay in sync.
export function refreshThemeToggleLabel() {
    updateToggleButton(currentMode);
}
