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

                            // Dynamically build tooltip from raw data based on current language
                            const T = translations[state.currentLang];
                            const pointSuffix = T.pointsSuffix || 'pts';
                            let tooltipLines = [];

                            // Helper functions to get icons based on scores
                            const getWindDirIcon = (score) => score > 0 ? '✅' : '⚠️';
                            const getSuckEffectIcon = (val) => val >= 2 ? '✅' : '⚠️';
                            const getWindSpeedIcon = (score) => score > 0 ? '✅' : '⚠️';

                            // 1. Forecast Label & Score
                            tooltipLines.push(`\n${T.forecastLabel} ${T[entry.finalForecastKey]}`);
                            if (entry.scoreText) {
                                tooltipLines.push(entry.scoreText.replace(/<[^>]*>/g, ''));
                            }

                            // 2. Predicted Wind
                            const predictedWindKnotsText = `${entry.pKnots_min}-${entry.pKnots_max} ${T.knotsUnit}`;
                            const predictedWindMsText = `(${(entry.pMs_min).toFixed(1)}-${(entry.pMs_max).toFixed(1)} ${T.msUnit})`;
                            tooltipLines.push(`${T.predictedWindLabel} ${predictedWindKnotsText} ${predictedWindMsText}`);

                            // 3. Cloud Cover
                            tooltipLines.push(`${entry.cloud_cover_value > 30 ? '⚠️' : '✅'} ${T.cloudCoverLabel} ${entry.cloud_cover_value}% (${entry.cloud_cover_score > 0 ? '+' : ''}${entry.cloud_cover_score} ${pointSuffix})`);

                            // 4. Temp Difference
                            const tempDiffDescriptionText = T[entry.temp_diff_description_key] || entry.temp_diff_description_key;
                            const tempDiffValueText = typeof entry.temp_diff_value === 'number' ? entry.temp_diff_value.toFixed(1) : 'N/A';
                            const airTempValueText = typeof entry.air_temp_value === 'number' ? entry.air_temp_value.toFixed(1) : 'N/A';
                            const seaTempValueText = typeof entry.sea_temp_value === 'number' ? entry.sea_temp_value.toFixed(1) : 'N/A';
                            tooltipLines.push(`${entry.temp_diff_value >= 6 ? '✅' : '⚠️'} ${T.tempDiffDetail.replace('{description}', tempDiffDescriptionText).replace('{value}', tempDiffValueText).replace('{landTemp}', airTempValueText).replace('{seaTemp}', seaTempValueText)} (${entry.temp_diff_score > 0 ? '+' : ''}${entry.temp_diff_score} ${pointSuffix})`);

                            // 5. Max Wind Speed API
                            const windSpeedValueText = typeof entry.wind_speed_value === 'number' ? entry.wind_speed_value.toFixed(1) : 'N/A';
                            tooltipLines.push(`${getWindSpeedIcon(entry.wind_speed_score)} ${T.apiWindSpeedLabel} ${windSpeedValueText} km/h (${entry.wind_speed_score > 0 ? '+' : ''}${entry.wind_speed_score} ${pointSuffix})`);

                            // 6. Wind Direction
                            tooltipLines.push(`${getWindDirIcon(entry.wind_direction_score)} ${T.windDirDetail.replace('{value}', entry.wind_direction_value).replace('{description}', entry.wind_direction_description)} (${entry.wind_direction_score > 0 ? '+' : ''}${entry.wind_direction_score} ${pointSuffix})`);

                            // 7. Suck Effect
                            const suckEffectDisplay = `${entry.suck_effect_score_value}/3`;
                            tooltipLines.push(`${getSuckEffectIcon(entry.suck_effect_score_value)} ${T.suckEffectLabel} ${suckEffectDisplay} (${entry.suck_effect_score_value > 0 ? '+' : ''}${entry.suck_effect_score_value} ${pointSuffix})`);

                            // 8. Water Temp
                            if (entry.waterTemp !== undefined && entry.waterTemp !== null) {
                                tooltipLines.push(`${T.waterTempLabel} ${entry.waterTemp.toFixed(1)}°C`);
                            }

                            return tooltipLines;
                        }
                    }
                },
                annotation: {
                    annotations: {
                        line1: {
                            type: 'line',
                            yScaleID: 'yKnots',
                            yMin: 16,
                            yMax: 16,
                            borderColor: 'red',
                            borderWidth: 2,
                            label: {
                                enabled: true,
                                content: 'Good Wind (16 knots)',
                                position: 'end',
                                backgroundColor: 'rgba(255, 99, 132, 0.8)'
                            }
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
