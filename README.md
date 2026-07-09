# 💨 Raches Thermal Wind Forecaster

**Live site:** [raches.vercel.app](https://raches.vercel.app/)

---

## 🎯 About the Project

**Raches Thermal Wind Forecaster** is a web application that provides a specialized forecast for the thermal wind in Raches, Greece – a popular destination for kitesurfing and windsurfing. The goal is to give riders a more accurate and easy-to-understand forecast by analyzing key meteorological factors that drive the local thermal wind.

The forecast is based on **11 scoring criteria** across three data sources (Raches spot, Lamia inland, Volos marine).

### Scoring Criteria (v3)

| # | Factor | Max pts | Min pts | Description |
|---|--------|---------|---------|-------------|
| 1 | ☀️ Total cloud cover | +5 | −2 | Daytime avg 05–16h from Lamia. Clear sky = land heats faster. |
| 2 | 🌡️ Land–sea temp difference | +5.25 | −1.5 | Lamia max air temp minus Volos sea temp at 13:00. Primary thermal driver. |
| 3 | 💨 Wind speed at 80m | +3.5 | −1 | Daily max from hourly 80m data — kite-relevant altitude. |
| 4 | 🧭 Wind direction (80m, 13–17h) | +3 | −8 | NE–E ideal (+3). W–NW kills thermal (−8). SE–S–SW stops it (−4). |
| 5 | ⚡ Suck effect | +2.5 | 0 | Morning → afternoon wind acceleration. Sharp rise = thermal intensification. |
| 6 | 📉 Pressure drop (09h→16h) | +3 | −2 | ≥4 hPa drop = strong thermal. Pressure rise = negative. |
| 7 | 💧 Afternoon humidity (13–17h) | +2 | −2 | Dry air (<40%) heats land faster. Very humid air inhibits heating. |
| 8 | 🌧️ Precipitation probability (13–17h) | +1 | −4 | Rain cools land and stops thermals. |
| 9 | 🌪️ Atmospheric instability (lapse rate) | +3 | −2 | Temp difference 2m − 180m at 11–14h. ≥6°C = unstable air = strong thermals. |
| 10 | 🔥 Vapour Pressure Deficit (VPD) | +2.5 | −1 | Afternoon avg. High VPD (>2 kPa) = dry+warm air = high thermal potential. |
| 11 | 🌫️ Low/mid cloud layer | +1.5 | −1.5 | Low clouds block solar radiation far more than high cirrus. Bonus for clear low sky. |

**Score range:** −25 to +32.25

### Wind Forecast Categories

| Category | Avg predicted knots |
|----------|-------------------|
| 🟢 HIGH probability of good conditions | ≥ 16 kn |
| 🟡 MEDIUM probability | 12–15 kn |
| 🔴 LOW probability | 8–11 kn |
| ⛔ Unsuitable for kiting | < 8 kn |

---

## ✨ Main Features

- **11-Factor Scoring:** Comprehensive analysis across wind, temperature, clouds, pressure, humidity, lapse rate, and VPD.
- **Self-Correcting ML Model:** Monthly ridge regression models trained on cross-year aggregated historical data. Each month's model pools all available records from that calendar month across all years, blending in neighbouring months when data is thin.
- **Accurate Wind Prediction:** Score → baseline knot range via calibrated lookup table, then per-month linear regression correction (±20 kn clamped).
- **Visual Score Bar:** Colour-coded progress bar showing daily score level at a glance.
- **Historical Charts:** Predicted vs. real wind overlay; real station wind bar chart (daily max + best 90-min avg).
- **Real Station Data:** Wind observations from kiting.live (5-min intervals), matched to forecast records for model training.
- **Bilingual:** English and Bulgarian throughout.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES modules), HTML5, CSS3 |
| Charts | Chart.js 3.9.1 |
| Date picker | Flatpickr |
| Backend | Node.js Serverless Functions (Vercel) |
| Database | Upstash Redis |
| Math / ML | mathjs (ridge regression) |
| Deployment | Vercel (with cron jobs) |
| Weather data | [Open-Meteo API](https://open-meteo.com/) (3 locations) |
| Station data | kiting.live API |

### Open-Meteo Data Sources

| Location | Purpose | Key parameters |
|----------|---------|----------------|
| Raches (38.867°N, 22.759°E) | Wind, pressure, lapse rate, VPD | `wind_speed_80m`, `wind_direction_80m`, `temperature_2m`, `temperature_180m`, `vapour_pressure_deficit`, `surface_pressure` |
| Lamia (38.903°N, 22.443°E) | Temperature, cloud cover | `temperature_2m`, `cloud_cover`, `cloud_cover_low`, `cloud_cover_mid`, `cloud_cover_high` |
| Volos marine (38.953°N, 22.967°E) | Sea surface temperature | `sea_surface_temperature` at 13:00 |

---

## 🚀 How to Use

1. Visit [raches.vercel.app](https://raches.vercel.app/)
2. Double-click a single date, or drag to select a range.
3. Press **"Analyze"**.
4. Review the forecast card for each day — each factor is scored and explained.

---

## 💡 How It Works

1. **Data fetch:** Three parallel Open-Meteo requests (Raches, Lamia, Volos marine) plus historical data from Redis.
2. **Scoring:** 11 sub-scores computed from hourly data (afternoon windows, daytime averages, lapse rate peaks).
3. **Wind prediction:** Score → baseline knot range (calibrated lookup table) → per-month ridge regression correction.
4. **Model training:** Nightly cron (15:00 UTC) fetches real station data, retrains correction models, and updates peak-hour averages.
5. **Display:** Forecast cards with score breakdown, score bar, predicted wind range, real wind overlay if available.

---

## 🎯 За Проекта (Bulgarian)

**Raches Thermal Wind Forecaster** е уеб приложение за специализирана прогноза на термичния вятър в Рахес, Гърция. Анализира 11 метеорологични фактора от три различни локации.

### Критерии за точкуване (v3)

| # | Фактор | Макс | Мин | Описание |
|---|--------|------|-----|----------|
| 1 | ☀️ Обща облачност | +5 | −2 | Дневна средна 05–16h от Ламия. |
| 2 | 🌡️ Темп. разлика суша-море | +5.25 | −1.5 | Макс. температура Ламия минус морска температура Рахес в 13:00. |
| 3 | 💨 Скорост на вятъра на 80m | +3.5 | −1 | Дневен максимум от почасови данни за 80m — кайт-релевантна височина. |
| 4 | 🧭 Посока на вятъра (80m, 13–17h) | +3 | −8 | СИ–И идеална (+3). З–СЗ убива термиката (−8). |
| 5 | ⚡ Suck ефект | +2.5 | 0 | Ускорение на вятъра от сутринта към следобеда. |
| 6 | 📉 Спад в налягане (09h→16h) | +3 | −2 | ≥4 hPa спад = силна термика. |
| 7 | 💧 Следобедна влажност | +2 | −2 | Сух въздух (<40%) нагрява сушата по-бързо. |
| 8 | 🌧️ Вероятност за валежи | +1 | −4 | Дъждът охлажда земята и спира термиката. |
| 9 | 🌪️ Атм. нестабилност (лапс рейт) | +3 | −2 | Разлика temp 2m − 180m при 11–14h. ≥6°C = нестабилен въздух = силна термика. |
| 10 | 🔥 Дефицит на парно налягане (VPD) | +2.5 | −1 | Следобедна средна. Висок VPD (>2 kPa) = сух+топъл въздух = висок термичен потенциал. |
| 11 | 🌫️ Нисък/среден облачен слой | +1.5 | −1.5 | Ниските облаци блокират слънчевата радиация много повече от перести облаци. |

**Диапазон на оценката:** −25 до +32.25

### Категории прогноза

| Категория | Средно прогнозирани възли |
|-----------|--------------------------|
| 🟢 ВИСОКА вероятност за добри условия | ≥ 16 kn |
| 🟡 СРЕДНА вероятност | 12–15 kn |
| 🔴 НИСКА вероятност | 8–11 kn |
| ⛔ Неподходящо за кайт | < 8 kn |

### Технологии

- **Frontend:** Vanilla JS ES модули, HTML5, CSS3, Chart.js, Flatpickr
- **Backend:** Node.js Serverless (Vercel), Upstash Redis, mathjs (ridge regression)
- **Данни:** Open-Meteo (3 локации), kiting.live (реална станция)
- **ML модел:** Месечна ridge regression, обучена върху агрегирани данни от всички години за съответния месец
