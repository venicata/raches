# 💨 Raches Thermal Wind Forecaster

Live site

https://raches.vercel.app/

## 🎯 About the Project

5 Criteria by which the script evaluates the wind forecast

In Raches, the thermal wind intensifies when the following 5 conditions are present simultaneously:

✅ 1. Sunny and clear sky (no clouds until noon)

➡️ Windy: enable the Clouds layer → look for very few clouds before 13:00.
Why? The sun needs to warm the land to create a temperature difference between land and sea.

---

✅ 2. Land-sea temperature difference

➡️ Windy: enable the Airgram or Meteogram layer.
Look for:

Air temperature on land (e.g., 30°C)

Sea temperature (usually 23–25°C)


The greater the difference, the stronger the thermal breeze.

---

✅ 3. Weak to moderate synoptic circulation from the east or northeast (ENE/NE)

➡️ Windy: enable the Wind layer → observe the arrows in the Raches area

The ideal scenario is 5–10 knots from ENE/NE in the morning (until noon)

This "helps" the thermal wind without suppressing it

---

✅ 4. No strong west or south wind

➡️ It is important that there is no wind against the thermal.

Wind from W, SW, S will kill or reverse it.

Avoid days with a forecast for west wind after 15:00.

---

✅ 5. Local suction effect (you can "see" it in Windy by the wind accelerating around 14–16h)

➡️ Windy: in the Wind layer, place the cursor on the spot's location (Raches)

If the wind sharply increases after 13:00 (e.g., from 6 to 15 knots), this is THERMAL INTENSIFICATION.


---------------------------------------------------------------------------

**Raches Thermal Wind Forecaster** is a web application, created with the help of an AI assistant, that provides a specialized forecast for the thermal wind in Raches, Greece – a popular destination for kitesurfing and windsurfing.

The goal of the project is to give riders a more accurate and easy-to-understand forecast by analyzing key meteorological factors that influence the local thermal wind (known as the "suck effect").

## ✨ Main Features

*   **Period Selection:** Ability to select a single date or a period for analysis.
*   **Complex Analysis:** The application analyzes 5 key factors:
    1.  **Cloud Cover:** Fewer clouds mean stronger sun and a greater thermal effect.
    2.  **Temperature Difference (land-sea):** The main driver of thermal wind.
    3.  **Base Wind Speed:** Data from the global model.
    4.  **Wind Direction:** Assessment of whether the direction is suitable for the spot.
    5.  **"Suck" Effect:** Assessment of the potential for thermal wind.
*   **Calibrated Wind Forecast:** Predicts a wind speed range in **knots**, calibrated according to real observations for the spot (target: 18-24 knots on good days).
*   **Visual Indicators:** Each forecast is accompanied by icons (✅, ⚠️, ❌) that provide a quick visual assessment of the conditions.
*   **Clear and Modern Design:** Results are presented in easy-to-read "cards," one for each day, with a stylized design for better clarity.

## 🛠️ Technologies

*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
*   **Libraries:**
    *   [Flatpickr.js](https://flatpickr.js.org/) - for the calendar and date selection.
*   **API:**
    *   [Open-Meteo API](https://open-meteo.com/) - for meteorological and marine data.

## 🚀 How to use?

1.  Open the `index.html` file in your web browser.
2.  Use the calendar to select a date (double-click) or a date range.
3.  Press the **"Analyze"** button.
4.  Review the detailed forecast for each selected day.

## 💡 How does it work?

The script (`script.js`) sends requests to two Open-Meteo API endpoints (`forecast` and `marine`) to collect data on air temperature, cloud cover, wind, and sea water temperature.

Then, the `processWeatherData` function processes this data by applying a scoring system to evaluate the five key factors. A final forecast is generated based on the total score.



## 🎯 За Проекта

5 Критерия по които скрипта оценява прогнозата за вятъра

В Рахес термиката се засилва, когато са налице следните 5 условия едновременно:

✅ 1. Слънчево и ясно небе (без облаци до обяд)

➡️ Windy: включи слоя Clouds → търси много малко облаци преди 13:00.
Защо? Слънцето трябва да затопли сушата, за да се създаде температурна разлика между суша и море.

---

✅ 2. Температурна разлика суша-море

➡️ Windy: включи слоя Airgram или Meteogram.
Търси:

Температура на въздуха на сушата (примерно 30°C)

Температура на морето (обикновено 23–25°C)


Колкото по-голяма е разликата, толкова по-силен е термичният бриз.

---

✅ 3. Слаба до умерена синоптична циркулация от изток или североизток (ENE/NE)

➡️ Windy: включи слоя Wind → наблюдавай стрелките в района на Raches

Идеалният сценарий е 5–10 възела от ENE/NE сутринта (до обяд)

Това "помага" на термиката, без да я задушава

---

✅ 4. Без силен западен или южен вятър

➡️ Важно е да няма вятър срещу термиката.

Вятър от W, SW, S ще я убие или обърне.

Избягвай дни с прогноза за западен вятър след 15:00.

---

✅ 5. Местен ефект на засмукване (можеш да го „видиш“ в Windy по ускоряване на вятъра около 14–16 ч.)

➡️ Windy: в слоя Wind, постави курсора на мястото на спота (Raches)

Ако след 13:00 вятърът рязко се усилва (примерно от 6 на 15 възела), това е ТЕРМИЧНО ЗАСИЛВАНЕ.


---------------------------------------------------------------------------

**Raches Thermal Wind Forecaster** е уеб приложение, създадено с помощта на AI асистент, което предоставя специализирана прогноза за термичния вятър в Рахес, Гърция – популярна дестинация за кайтсърф и уиндсърф.

Целта на проекта е да даде на карачите по-точна и лесна за разбиране прогноза, като анализира ключови метеорологични фактори, които влияят на локалния термичен вятър (известен като "suck effect").

## ✨ Основни Функционалности

*   **Избор на период:** Възможност за избор на единична дата или период за анализ.
*   **Комплексен анализ:** Приложението анализира 5 ключови фактора:
    1.  **Облачност:** По-малко облаци означават по-силно слънце и по-голям термичен ефект.
    2.  **Температурна разлика (суша-море):** Основен двигател на термичния вятър.
    3.  **Базова скорост на вятъра:** Данни от глобалния модел.
    4.  **Посока на вятъра:** Оценка дали посоката е подходяща за спота.
    5.  **"Suck" ефект:** Оценка на потенциала за термичен вятър.
*   **Калибрирана прогноза за вятъра:** Прогнозира диапазон на скоростта на вятъра в **възли**, калибриран според реалните наблюдения за спота (цел: 18-24 възела в добрите дни).
*   **Визуални индикатори:** Всяка прогноза е придружена от икони (✅, ⚠️, ❌), които дават бърза визуална оценка на условията.
*   **Ясен и модерен дизайн:** Резултатите са представени в лесни за четене "карти", по една за всеки ден, със стилизиран дизайн за по-добра прегледност.

## 🛠️ Технологии

*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
*   **Библиотеки:**
    *   [Flatpickr.js](https://flatpickr.js.org/) - за календара и избор на дати.
*   **API:**
    *   [Open-Meteo API](https://open-meteo.com/) - за метеорологични и морски данни.

## 🚀 Как да използвам?

1.  Отворете файла `index.html` във вашия уеб браузър.
2.  Използвайте календара, за да изберете дата (кликнете два пъти) или период от дати.
3.  Натиснете бутона **"Анализирай"**.
4.  Разгледайте детайлната прогноза за всеки избран ден.

## 💡 Как работи?

Скриптът (`script.js`) изпраща заявки до два endpoint-а на Open-Meteo API (`forecast` и `marine`), за да събере данни за температура на въздуха, облачност, вятър и температура на морската вода.

След това, функцията `processWeatherData` обработва тези данни, като прилага точкова система за оценка на петте ключови фактора. На база на общия брой точки се генерира финална прогноза.

Функцията `predictWindSpeedRange` използва базовия вятър от API-то и го надгражда със стойности, базирани на силата на "suck" ефекта, за да даде по-реалистична прогноза за силата на вятъра в Рахес.