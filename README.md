# 💨 Raches Thermal Wind Forecaster

Live site

https://raches.vercel.app/

## 🎯 About the Project

**Raches Thermal Wind Forecaster** is a web application that provides a specialized forecast for the thermal wind in Raches, Greece – a popular destination for kitesurfing and windsurfing. The goal is to give riders a more accurate and easy-to-understand forecast by analyzing key meteorological factors that influence the local thermal wind.

The forecast is based on **8 key criteria** for thermal wind intensification:

1.  **☀️ Sunny and clear sky:** Allows the sun to heat the land.
2.  **🌡️ Land-sea temperature difference:** The main driver of the thermal breeze.
3.  **💨 Weak E/NE synoptic wind:** Helps the thermal without overpowering it.
4.  **🌬️ No opposing W/S wind:** Winds from the west or south can cancel the thermal effect.
5.  **⚡ Local suction effect:** A sharp increase in wind speed in the afternoon indicates thermal intensification.
6.  **📉 Drop in atmospheric pressure:** A drop of 2-3 hPa during the day is a good indicator.
7.  **💧 Low relative humidity:** Dry air allows the land to heat up more intensely.
8.  **🌧️ No precipitation:** Rain cools the ground and stops the thermal effect.

## ✨ Main Features

*   **8-Factor Analysis:** The application analyzes 8 key meteorological factors for a comprehensive forecast.
*   **Self-Correcting AI Model:** Uses historical forecast data and real wind observations to continuously calibrate its prediction model, improving accuracy over time.
*   **Historical Data Chart:** Visualizes past forecasts against real wind data, helping to track model performance.
*   **Interactive UI:**
    *   Detailed explanations for each scoring criterion are available on hover (tooltips).
    *   A modal window explains the criteria for thermal wind.
*   **Visual Indicators:** Each forecast is accompanied by icons (✅, ⚠️, ❌) for a quick visual assessment.
*   **Bilingual Interface:** Available in English and Bulgarian.

## 🛠️ Technologies

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript
*   **Backend:** Node.js Serverless Functions
*   **Database:** Upstash Redis (for storing the AI correction model)
*   **Deployment:** Vercel
*   **Libraries:**
    *   [Flatpickr.js](https://flatpickr.js.org/) - for the calendar.
    *   [Chart.js](https://www.chartjs.org/) - for the historical data chart.
*   **APIs:**
    *   [Open-Meteo API](https://open-meteo.com/) - for meteorological data.

## 🚀 How to use?

1.  Visit the live site: [raches.vercel.app](https://raches.vercel.app/)
2.  Use the calendar to select a date or a date range.
3.  Press the **"Analyze"** button.
4.  Review the detailed forecast for each selected day.

## 💡 How does it work?

The application fetches weather data from the Open-Meteo API. A set of serverless functions (`/api`) processes this data, applying a scoring system based on the 8 criteria. A machine learning model, stored in Redis, corrects the final wind prediction based on past performance. The results, including a detailed breakdown and a historical chart, are displayed on the frontend.

---

## 🎯 За Проекта

**Raches Thermal Wind Forecaster** е уеб приложение, което предоставя специализирана прогноза за термичния вятър в Рахес, Гърция. Целта е да даде на карачите по-точна и лесна за разбиране прогноза, като анализира ключови метеорологични фактори.

Прогнозата се базира на **8 ключови критерия** за засилване на термичния вятър:

1.  **☀️ Слънчево и ясно небе:** Позволява на слънцето да нагрее сушата.
2.  **🌡️ Температурна разлика суша-море:** Основният двигател на термичния бриз.
3.  **💨 Слаб източен/североизточен синоптичен вятър:** Подпомага термиката, без да я надделява.
4.  **🌬️ Липса на противоположен западен/южен вятър:** Ветрове от запад или юг могат да неутрализират термичния ефект.
5.  **⚡ Местен ефект на засмукване:** Рязкото усилване на вятъра следобед е индикатор за термично засилване.
6.  **📉 Спад в атмосферното налягане:** Спад от 2-3 hPa през деня е добър индикатор.
7.  **💧 Ниска относителна влажност:** Сухият въздух позволява на сушата да се нагрее по-интензивно.
8.  **🌧️ Липса на валежи:** Дъждът охлажда земята и спира термичния ефект.

## ✨ Основни Функционалности

*   **Анализ по 8 фактора:** Приложението анализира 8 ключови метеорологични фактора за пълна прогноза.
*   **Самокоригиращ се AI модел:** Използва исторически данни от прогнози и реални наблюдения на вятъра, за да калибрира непрекъснато своя модел за прогнозиране, подобрявайки точността с времето.
*   **Графика с исторически данни:** Визуализира минали прогнози спрямо реални данни за вятъра, помагайки за проследяване на ефективността на модела.
*   **Интерактивен интерфейс:**
    *   Подробни обяснения за всеки критерий за точкуване са достъпни при посочване с мишката (tooltips).
    *   Модален прозорец обяснява критериите за термичен вятър.
*   **Визуални индикатори:** Всяка прогноза е придружена от икони (✅, ⚠️, ❌) за бърза визуална оценка.
*   **Двуезичен интерфейс:** Наличен на английски и български език.

## 🛠️ Технологии

*   **Frontend:** HTML5, CSS3, Vanilla JavaScript
*   **Backend:** Node.js Serverless Functions
*   **База данни:** Upstash Redis (за съхранение на AI корекционния модел)
*   **Deployment:** Vercel
*   **Библиотеки:**
    *   [Flatpickr.js](https://flatpickr.js.org/) - за календара.
    *   [Chart.js](https://www.chartjs.org/) - за графиката с исторически данни.
*   **API:**
    *   [Open-Meteo API](https://open-meteo.com/) - за метеорологични данни.

## 🚀 Как да използвам?

1.  Посетете сайта: [raches.vercel.app](https://raches.vercel.app/)
2.  Използвайте календара, за да изберете дата или период.
3.  Натиснете бутона **"Анализирай"**.
4.  Разгледайте детайлната прогноза за всеки избран ден.

## 💡 Как работи?

Приложението извлича метеорологични данни от Open-Meteo API. Набор от serverless функции (`/api`) обработва тези данни, като прилага точкова система, базирана на 8-те критерия. Модел за машинно обучение, съхранен в Redis, коригира финалната прогноза за вятъра на базата на минали резултати. Резултатите, включително подробна разбивка и историческа графика, се показват на фронтенда.