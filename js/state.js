export const state = {
    currentLang: 'bg',
    historicalChartInstance: null,
    realWindChartInstance: null,
    realWindChartView: 'daily', // 'daily' or 'weekly'
    realWindHistory: [],
    resultsContainer: null,
    datePicker: null,
    isAdmin: false, // Admin mode flag
    adminKey: null // Password sent as the x-admin-key header on admin API calls
};
