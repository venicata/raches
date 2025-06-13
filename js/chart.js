import { getHistoricalData } from './api.js';
import { translations } from './translations.js';
import { state } from './state.js';

export async function renderHistoricalChart() {
    const historicalData = await getHistoricalData();
    const chartSection = document.getElementById('chartSection');
    const chartCanvas = document.getElementById('historicalWindChart');
    const chartTitleEl = document.getElementById('historicalChartTitleKey');

    if (chartTitleEl) {
        chartTitleEl.textContent = translations[state.currentLang].historicalChartTitleKey;
    }

    if (!historicalData || historicalData.length === 0) {
        if (chartSection) chartSection.style.display = 'none';
        if (state.historicalChartInstance) {
            state.historicalChartInstance.destroy();
            state.historicalChartInstance = null;
        }
        return;
    }

    if (chartSection) chartSection.style.display = 'block';

    const labels = historicalData.map(entry => {
        return new Date(entry.date).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', {
            month: 'short', day: 'numeric'
        });
    });
    const avgKnotsData = historicalData.map(entry => entry.avgPredictedKnots);
    const avgMsData = historicalData.map(entry => entry.avgPredictedMs);

    const chartData = {
        labels: labels,
        datasets: [
            {
                label: translations[state.currentLang].knotsUnit,
                data: avgKnotsData,
                borderColor: 'rgb(75, 192, 192)',
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                yAxisID: 'yKnots',
                tension: 0.1
            },
            {
                label: translations[state.currentLang].msUnit,
                data: avgMsData,
                borderColor: 'rgb(255, 99, 132)',
                backgroundColor: 'rgba(255, 99, 132, 0.2)',
                yAxisID: 'yMs',
                hidden: false,
                tension: 0.1
            }
        ]
    };

    if (state.historicalChartInstance) {
        state.historicalChartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d');
    state.historicalChartInstance = new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false,
            plugins: {
                title: {
                    display: false,
                },
                tooltip: {
                    callbacks: {
                        title: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const entryDate = historicalData[dataIndex].date;
                            return new Date(entryDate).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', {
                                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                            });
                        },
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const entry = historicalData[dataIndex];
                            if (!entry) return '';
                            let tooltipLines = [];
                            tooltipLines.push(`\n${entry.forecastLabelText}`);
                            tooltipLines.push(entry.predictedWindText);
                            tooltipLines.push(entry.cloudCoverDetailText);
                            tooltipLines.push(entry.tempDiffDetailText);
                            tooltipLines.push(entry.maxWindSpeedApiDetailText);
                            tooltipLines.push(entry.windDirectionDetailText);
                            tooltipLines.push(entry.suckEffectDetailText);
                            return tooltipLines;
                        }
                    }
                }
            },
            scales: {
                yKnots: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: translations[state.currentLang].knotsUnit
                    }
                },
                yMs: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: translations[state.currentLang].msUnit
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                }
            }
        }
    });
}
