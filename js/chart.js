import { getAppData } from './api.js';
import { translations } from './translations.js';
import { state } from './state.js';

// Helper to get the week number for a given date
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return [d.getUTCFullYear(), weekNo];
}

export function renderRealWindChart() {
    const T = translations[state.currentLang];
    const chartSection = document.getElementById('realWindChartSection');
    const chartCanvas = document.getElementById('realWindChart');
    const chartTitleEl = document.getElementById('realWindChartTitleKey');

    if (chartTitleEl) {
        chartTitleEl.textContent = T.realWindChartTitleKey || 'Real Wind';
    }

    if (!state.realWindHistory || state.realWindHistory.length === 0) {
        if (chartSection) chartSection.style.display = 'none';
        if (state.realWindChartInstance) {
            state.realWindChartInstance.destroy();
            state.realWindChartInstance = null;
        }
        return;
    }

    if (chartSection) chartSection.style.display = 'block';

    if (state.realWindChartInstance) {
        state.realWindChartInstance.destroy();
    }

    let labels;
    let realWindData;

    if (state.realWindChartView === 'weekly') {
        const weeklyData = state.realWindHistory.reduce((acc, d) => {
            const [year, week] = getWeekNumber(new Date(d.timestamp));
            const key = `${year}-W${week}`;
            if (!acc[key]) {
                acc[key] = { windSpeeds: [], count: 0, startDate: new Date(d.timestamp) };
            }
            acc[key].windSpeeds.push(d.windSpeedKnots);
            acc[key].count++;
            return acc;
        }, {});

        labels = Object.keys(weeklyData).sort((a, b) => new Date(weeklyData[a].startDate) - new Date(weeklyData[b].startDate)).map(key => {
            const startDate = weeklyData[key].startDate;
            const endDate = new Date(startDate);
            endDate.setDate(startDate.getDate() + 6);
            const lang = state.currentLang === 'bg' ? 'bg-BG' : 'en-CA';
            return `${startDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}`;
        });
        realWindData = Object.keys(weeklyData).sort((a, b) => new Date(weeklyData[a].startDate) - new Date(weeklyData[b].startDate)).map(key => {
            const week = weeklyData[key];
            const sum = week.windSpeeds.reduce((a, b) => a + b, 0);
            return sum / week.count;
        });

    } else if (state.realWindChartView === 'monthly') {
        const monthlyData = state.realWindHistory.reduce((acc, d) => {
            const date = new Date(d.timestamp);
            const key = `${date.getFullYear()}-${date.getMonth()}`;
            if (!acc[key]) {
                acc[key] = { windSpeeds: [], count: 0, date: date };
            }
            acc[key].windSpeeds.push(d.windSpeedKnots);
            acc[key].count++;
            return acc;
        }, {});

        labels = Object.keys(monthlyData).sort((a, b) => monthlyData[a].date - monthlyData[b].date).map(key => {
            const date = monthlyData[key].date;
            return date.toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-CA', { year: 'numeric', month: 'long' });
        });
        realWindData = Object.keys(monthlyData).sort((a, b) => monthlyData[a].date - monthlyData[b].date).map(key => {
            const month = monthlyData[key];
            const sum = month.windSpeeds.reduce((a, b) => a + b, 0);
            return sum / month.count;
        });

    } else { // Daily view
        let dataToRender = state.realWindHistory;
        // On mobile (screen width < 768px), show only the last 30 days
        if (window.innerWidth < 768) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            dataToRender = state.realWindHistory.filter(d => new Date(d.timestamp) >= thirtyDaysAgo);
        }

        labels = dataToRender.map(d => new Date(d.timestamp).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-CA', { month: 'short', day: 'numeric' }));
        realWindData = dataToRender.map(d => d.windSpeedKnots);
    }

    const ctx = chartCanvas.getContext('2d');
    state.realWindChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: T.knotsUnit || 'knots',
                data: realWindData,
                backgroundColor: 'rgba(255, 99, 132, 0.5)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            plugins: {
                legend: {
                    display: false // Hides the legend
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: T.knotsUnit || 'knots'
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

export function renderHistoricalChart() {
    const historicalData = state.historicalForecastData || [];
    const realWindHistory = state.realWindHistory || [];

    const today = new Date();
    today.setHours(23, 59, 59, 999); // Set to end of day to include today in filtering

    const filteredData = historicalData.filter(entry => new Date(entry.date) <= today);

    const realWindMap = new Map(realWindHistory.map(r => [r.timestamp.split('T')[0], r]));

    filteredData.forEach(entry => {
        const realWindRecord = realWindMap.get(entry.date);
        if (realWindRecord) {
            entry.realWind = realWindRecord;
        }
    });

    const chartSection = document.getElementById('chartSection');
    const chartCanvas = document.getElementById('historicalWindChart');
    const chartTitleEl = document.getElementById('historicalChartTitleKey');

    if (chartTitleEl) {
        chartTitleEl.textContent = translations[state.currentLang].historicalChartTitleKey;
    }

    if (!filteredData || filteredData.length === 0) {
        if (chartSection) chartSection.style.display = 'none';
        if (state.historicalChartInstance) {
            state.historicalChartInstance.destroy();
            state.historicalChartInstance = null;
        }
        return;
    }

    if (chartSection) chartSection.style.display = 'block';

    let labels, forecastData, avgMsData, realWindComparisonData;
    let dataForChart = filteredData; // Default to all filtered data

    switch (state.historicalChartView) {
        case 'weekly': {
            const weeklyData = filteredData.reduce((acc, d) => {
                const [year, week] = getWeekNumber(new Date(d.date));
                const key = `${year}-W${week}`;
                if (!acc[key]) {
                    acc[key] = { forecastKnots: [], forecastMs: [], realKnots: [], count: 0, startDate: new Date(d.date) };
                }
                acc[key].forecastKnots.push(d.avgPredictedKnots);
                acc[key].forecastMs.push(d.avgPredictedMs);
                if (d.realWind) {
                    acc[key].realKnots.push(d.realWind.windSpeedKnots);
                }
                acc[key].count++;
                return acc;
            }, {});

            const sortedKeys = Object.keys(weeklyData).sort((a, b) => new Date(weeklyData[a].startDate) - new Date(weeklyData[b].startDate));

            // Create an array of aggregated objects for the tooltip
            dataForChart = sortedKeys.map(key => weeklyData[key]);

            labels = sortedKeys.map(key => {
                const startDate = weeklyData[key].startDate;
                const endDate = new Date(startDate);
                endDate.setDate(startDate.getDate() + 6);
                const lang = state.currentLang === 'bg' ? 'bg-BG' : 'en-CA';
                return `${startDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString(lang, { month: 'short', day: 'numeric' })}`;
            });
            forecastData = sortedKeys.map(key => weeklyData[key].forecastKnots.reduce((a, b) => a + b, 0) / weeklyData[key].forecastKnots.length);
            avgMsData = sortedKeys.map(key => weeklyData[key].forecastMs.reduce((a, b) => a + b, 0) / weeklyData[key].forecastMs.length);
            realWindComparisonData = sortedKeys.map(key => {
                const week = weeklyData[key];
                return week.realKnots.length > 0 ? week.realKnots.reduce((a, b) => a + b, 0) / week.realKnots.length : null;
            });
            break;
        }
        case 'monthly': {
            const monthlyData = filteredData.reduce((acc, d) => {
                const date = new Date(d.date);
                const key = `${date.getFullYear()}-${date.getMonth()}`;
                if (!acc[key]) {
                    acc[key] = { forecastKnots: [], forecastMs: [], realKnots: [], count: 0, date: date };
                }
                acc[key].forecastKnots.push(d.avgPredictedKnots);
                acc[key].forecastMs.push(d.avgPredictedMs);
                if (d.realWind) {
                    acc[key].realKnots.push(d.realWind.windSpeedKnots);
                }
                acc[key].count++;
                return acc;
            }, {});

            const sortedKeys = Object.keys(monthlyData).sort((a, b) => monthlyData[a].date - monthlyData[b].date);

            // Create an array of aggregated objects for the tooltip
            dataForChart = sortedKeys.map(key => monthlyData[key]);

            labels = sortedKeys.map(key => monthlyData[key].date.toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-CA', { year: 'numeric', month: 'long' }));
            forecastData = sortedKeys.map(key => monthlyData[key].forecastKnots.reduce((a, b) => a + b, 0) / monthlyData[key].forecastKnots.length);
            avgMsData = sortedKeys.map(key => monthlyData[key].forecastMs.reduce((a, b) => a + b, 0) / monthlyData[key].forecastMs.length);
            realWindComparisonData = sortedKeys.map(key => {
                const month = monthlyData[key];
                return month.realKnots.length > 0 ? month.realKnots.reduce((a, b) => a + b, 0) / month.realKnots.length : null;
            });
            break;
        }
        case 'all': { // All data view
            let dataToRender = filteredData;
            dataForChart = dataToRender;
            labels = dataToRender.map(d => new Date(d.date).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-CA', { month: 'short', day: 'numeric' }));
            forecastData = dataToRender.map(d => d.avgPredictedKnots);
            avgMsData = dataToRender.map(d => d.avgPredictedMs);
            realWindComparisonData = dataToRender.map(d => d.realWind ? d.realWind.windSpeedKnots : null);
            break;
        }
        default: { // Daily view
            let dataToRender = filteredData;
            // On mobile (screen width < 768px), show only the last 30 days, on desktop show last 45
            if (window.innerWidth < 768) {
                const thirtyDaysAgo = new Date();
                thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
                dataToRender = filteredData.filter(d => new Date(d.date) >= thirtyDaysAgo);
            } else {
                const fortyFiveDaysAgo = new Date();
                fortyFiveDaysAgo.setDate(fortyFiveDaysAgo.getDate() - 45);
                dataToRender = filteredData.filter(d => new Date(d.date) >= fortyFiveDaysAgo);
            }

            // Sort the data chronologically before rendering the chart
            dataToRender.sort((a, b) => new Date(a.date) - new Date(b.date));
            dataForChart = dataToRender;

            labels = dataToRender.map(d => new Date(d.date).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-CA', { month: 'short', day: 'numeric' }));
            forecastData = dataToRender.map(d => d.avgPredictedKnots);
            avgMsData = dataToRender.map(d => d.avgPredictedMs);
            realWindComparisonData = dataToRender.map(d => d.realWind ? d.realWind.windSpeedKnots : null);
            break;
        }
    }


    const chartData = {
        labels: labels,
        datasets: [
            {
                type: 'line',
                label: translations[state.currentLang].predictedWindLabel,
                data: forecastData,
                borderColor: 'rgb(54, 162, 235)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                yAxisID: 'yKnots',
                tension: 0.1
            },
            {
                type: 'line',
                label: translations[state.currentLang].realWindLabel,
                data: realWindComparisonData,
                backgroundColor: 'transparent',
                borderColor: 'rgb(255, 99, 132, 1)',
                borderWidth: 1.5,
                yAxisID: 'yKnots',
            },
            {
                type: 'line',
                label: translations[state.currentLang].msUnit,
                data: avgMsData,
                borderColor: 'rgb(255, 159, 64)',
                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                yAxisID: 'yMs',
                hidden: true,
                tension: 0.1
            }
        ]
    };

    if (state.historicalChartInstance) {
        state.historicalChartInstance.destroy();
    }

    const ctx = chartCanvas.getContext('2d');
    state.historicalChartInstance = new Chart(ctx, {
        type: 'bar', // Default type, but datasets specify their own
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
                        title: function (context) {
                            const dataIndex = context[0].dataIndex;
                            const entry = dataForChart[dataIndex];
                            if (!entry) return '';

                            // For aggregated views, the label is already formatted as a range or month name
                            if (state.historicalChartView === 'weekly' || state.historicalChartView === 'monthly') {
                                return context[0].label;
                            }

                            // For daily and all views, format the date
                            const entryDate = entry.date;
                            return new Date(entryDate).toLocaleDateString(state.currentLang === 'bg' ? 'bg-BG' : 'en-GB', {
                                weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                            });
                        },
                        afterBody: function (context) {
                            const dataIndex = context[0].dataIndex;
                            const entry = dataForChart[dataIndex];
                            if (!entry) return '';

                            const T = translations[state.currentLang];

                            // For aggregated views (weekly/monthly), the 'entry' object is different.
                            if (!entry.finalForecastKey) {
                                let tooltipLines = [];
                                const validKnots = entry.forecastKnots.filter(knots => knots != null && !isNaN(parseFloat(knots)));
                                const sumKnots = validKnots.reduce((acc, val) => acc + parseFloat(val), 0);
                                const avgKnots = validKnots.length > 0 ? sumKnots / validKnots.length : 0;

                                const validMs = entry.forecastMs.filter(ms => ms != null && ms !== '' && !isNaN(parseFloat(ms)));
                                let avgMs;
                                if (validMs.length > 0) {
                                    const sumMs = validMs.reduce((acc, val) => acc + parseFloat(val), 0);
                                    avgMs = sumMs / validMs.length;
                                } else {
                                    // If no valid m/s values, calculate from knots
                                    avgMs = avgKnots / 1.94384;
                                }

                                tooltipLines.push(`💨 ${T.avgForecastLabel || 'Avg Forecast'}: ${avgKnots.toFixed(1)} knots (${avgMs.toFixed(1)} m/s)`);

                                if (entry.realKnots && entry.realKnots.length > 0) {
                                    const avgRealKnots = entry.realKnots.reduce((a, b) => a + b, 0) / entry.realKnots.length;
                                    tooltipLines.push(`🚩 ${T.avgRealWindLabel || 'Avg Real Wind'}: ${avgRealKnots.toFixed(1)} knots`);
                                }

                                tooltipLines.push(`📝 ${T.recordsCountLabel || 'Records'}: ${entry.count}`);

                                return tooltipLines;
                            }

                            // Dynamically build tooltip from raw data for daily views
                            const pointSuffix = T.pointsSuffix || 'pts';
                            let tooltipLines = [];

                            // Helper functions to get icons based on scores
                            const getWindDirIcon = (score) => score > 0 ? '✅' : '⚠️';
                            const getSuckEffectIcon = (val) => val >= 2 ? '✅' : '⚠️';
                            const getWindSpeedIcon = (score) => score > 0 ? '✅' : '⚠️';

                            // 1. Forecast Label & Score
                            tooltipLines.push(`💨${T.forecastLabel} ${T[entry.finalForecastKey]}`);
                            if (entry.scoreText) {
                                tooltipLines.push('❶  ' + entry.scoreText.replace(/<[^>]*>/g, ''));
                            }

                            // 2. Predicted Wind
                            // Flexible check for both numbers and string representations from Redis
                            if (entry.pKnots_min != null && entry.pKnots_max != null) {
                                // Convert to numbers to be safe
                                const pKnots_min = parseFloat(entry.pKnots_min);
                                const pKnots_max = parseFloat(entry.pKnots_max);
                                const pMs_min = parseFloat(entry.pMs_min);
                                const pMs_max = parseFloat(entry.pMs_max);

                                const predictedWindKnotsText = `${pKnots_min.toFixed(1)}-${pKnots_max.toFixed(1)} ${T.knotsUnit}`;
                                const predictedWindMsText = `(${(pMs_min).toFixed(1)}-${(pMs_max).toFixed(1)} ${T.msUnit})`;
                                tooltipLines.push(`${T.predictedWindLabel} ${predictedWindKnotsText} ${predictedWindMsText}`);
                            }

                            // 9. Real Wind Data (if available)
                            if (entry.realWind) {
                                const realWindKnots = entry.realWind.windSpeedKnots.toFixed(1);
                                const realWindGustKnots = entry.realWind.windGustKnots.toFixed(1);
                                const realWindMs = (entry.realWind.windSpeedKnots * 0.5144).toFixed(1);
                                const realWindText = `${T.realWindLabel} ${realWindKnots} (пориви до ${realWindGustKnots}) ${T.knotsUnit} (${realWindMs} ${T.msUnit})`;
                                tooltipLines.push(`🌬️ ${realWindText}`);
                            }

                            // 3. Cloud Cover
                            tooltipLines.push(`${entry.cloud_cover_value > 30 ? '⚠️' : '✅'} ${T.cloudCoverLabel} ${entry.cloud_cover_value}% (${entry.cloud_cover_score > 0 ? '+' : ''}${entry.cloud_cover_score} ${pointSuffix})`);

                            // 4. Temp Difference
                            const tempDiffDescriptionText = T[entry.temp_diff_description_key] || entry.temp_diff_description_key || '';
                            const tempDiffValueText = typeof entry.temp_diff_value === 'number' ? entry.temp_diff_value.toFixed(1) : 'N/A';
                            const airTempValueText = typeof entry.air_temp_value === 'number' ? entry.air_temp_value.toFixed(1) : 'N/A';
                            const seaTempValueText = typeof entry.sea_temp_value === 'number' ? entry.sea_temp_value.toFixed(1) : 'N/A';
                            const tempDiffText = T.tempDiffDetailGraph
                                .replace('{description}', tempDiffDescriptionText)
                                .replace('{value}', tempDiffValueText)
                                .replace('{landTemp}', airTempValueText)
                                .replace('{seaTemp}', seaTempValueText);
                            tooltipLines.push(`${entry.temp_diff_value >= 6 ? '✅' : '⚠️'} ${tempDiffText} (${entry.temp_diff_score > 0 ? '+' : ''}${entry.temp_diff_score} ${pointSuffix})`);

                            // 5. Max Wind Speed API
                            if (typeof entry.wind_speed_value === 'number') {
                                const windSpeedKnots = entry.wind_speed_value * 0.539957;
                                const windSpeedMs = entry.wind_speed_value * 0.277778;
                                tooltipLines.push(`${getWindSpeedIcon(entry.wind_speed_score)} ${T.apiWindSpeedLabel} ${windSpeedKnots.toFixed(1)} ${T.knotsUnit} (${windSpeedMs.toFixed(1)} ${T.msUnit}) (${entry.wind_speed_score > 0 ? '+' : ''}${entry.wind_speed_score} ${pointSuffix})`);
                            } else {
                                tooltipLines.push(`${getWindSpeedIcon(entry.wind_speed_score)} ${T.apiWindSpeedLabel} N/A`);
                            }

                            // 6. Wind Direction
                            tooltipLines.push(`${getWindDirIcon(entry.wind_direction_score)} ${T.windDirDetail.replace('{value}', entry.wind_direction_value).replace('{description}', entry.wind_direction_description)} (${entry.wind_direction_score > 0 ? '+' : ''}${entry.wind_direction_score} ${pointSuffix})`);

                            // 7. Suck Effect
                            const suckEffectDisplay = `${entry.suck_effect_score_value}/3`;
                            tooltipLines.push(`${getSuckEffectIcon(entry.suck_effect_score_value)} ${T.suckEffectLabel} ${suckEffectDisplay} (${entry.suck_effect_score_value > 0 ? '+' : ''}${entry.suck_effect_score_value} ${pointSuffix})`);

                            // New Parameters
                            if (entry.pressure_drop_value != null) {
                                tooltipLines.push(`${entry.pressure_drop_score >= 1 ? '✅' : '⚠️'} ${T.pressureDropLabel} ${entry.pressure_drop_value.toFixed(1)} hPa (${entry.pressure_drop_score > 0 ? '+' : ''}${entry.pressure_drop_score} ${pointSuffix})`);
                            }
                            if (entry.humidity_value != null) {
                                tooltipLines.push(`${entry.humidity_score >= 0 ? '✅' : '⚠️'} ${T.humidityLabel} ${entry.humidity_value.toFixed(0)}% (${entry.humidity_score > 0 ? '+' : ''}${entry.humidity_score} ${pointSuffix})`);
                            }
                            if (entry.precipitation_probability_value != null) {
                                tooltipLines.push(`${entry.precipitation_probability_score > 0 ? '✅' : '⚠️'} ${T.precipitationLabel} ${entry.precipitation_probability_value}% (${entry.precipitation_probability_score > 0 ? '+' : ''}${entry.precipitation_probability_score} ${pointSuffix})`);
                            }

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
                            yMin: 18,
                            yMax: 18,
                            borderColor: 'red',
                            borderWidth: 2,
                            label: {
                                enabled: true,
                                backgroundColor: 'rgba(255, 99, 132, 0.2)'
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
