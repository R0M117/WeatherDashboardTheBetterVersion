document.addEventListener("DOMContentLoaded", function() {
  // ==============================================================================
  // 1) Dropdown Kota
  // =========================================
  $('.select2').select2({
    placeholder: "Pilih Kota",
    allowClear: true,
    width: '100%',
  });

  // ==============================================================================
  // 2) Initialize amCharts v5
  // =========================================
  am5.ready(function() {
    const root = am5.Root.new("chartContainer");
    root.setThemes([
      am5themes_Animated.new(root)
    ]);
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout
      })
    );

    // ==============================================================================
    // 2.1) X-axis
    // =====================================
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      cellStartLocation: 0.5,
      cellEndLocation: 0.5,
      autoRotate: true,
      rotation: -45,
      maxLabelPosition: 0.95,
      minLabelPosition: 0.05
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: "date",
        renderer: xRenderer,
      })
    );

    xRenderer.labels.template.setAll({ 
      location: 0.5, 
      rotation: -45, 
      maxWidth: 80, 
      truncate: true, 
      tooltipText: "{category}" 
    });
    xRenderer.grid.template.setAll({ location: 0.5 });

    // ==============================================================================
    // 2.2) Y-axis
    // =====================================
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: am5xy.AxisRendererY.new(root, {}),
        min: 0 
      })
    );

    // ==============================================================================
    // 2.3) Series: High Temp
    // =====================================
    const highTempSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "High Temp",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "high_temp",
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueY}°C"
        }),
        stacked: false 
      })
    );

    // Styling
    highTempSeries.fills.template.setAll({
      fill: am5.color(0xff0000), 
      fillOpacity: 0.2,
      visible: true
    });
    highTempSeries.strokes.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(0xff0000)
    });

    // Bullets
    highTempSeries.bullets.push(function() {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 3,
          fill: highTempSeries.get("stroke")
        })
      });
    });

    // ==============================================================================
    // 2.4) Series: Low Temp
    // =====================================
    const lowTempSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Low Temp",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "low_temp",
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{valueY}°C"
        }),
        stacked: false 
      })
    );

    // Styling
    lowTempSeries.fills.template.setAll({
      fillOpacity: 0.2,
      visible: true
    });
    lowTempSeries.strokes.template.setAll({
      strokeWidth: 2,
      stroke: am5.color(0x0000ff)
    });

    // Bullets
    lowTempSeries.bullets.push(function() {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 3,
          fill: lowTempSeries.get("stroke")
        })
      });
    });

    // ==============================================================================
    // 2.8) Weather Icons
    // =====================================
    const conditionSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Condition",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "low_temp", 
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, {
          labelText: "{condition}"
        })
      })
    );

    // Hide lines for icons
    conditionSeries.strokes.template.setAll({
      strokeOpacity: 0
    });

    // Add Icons as Bullets
    conditionSeries.bullets.push(function(root, series, dataItem) {
      if (dataItem.dataContext.icon && dataItem.dataContext.icon !== "default.png") {
        const container = am5.Container.new(root, {
          width: 50,
          height: 50,
          centerX: am5.percent(50),
          centerY: am5.percent(100)
        });

        container.children.push(
          am5.Picture.new(root, {
            href: `${STATIC_URL}images/${dataItem.dataContext.icon}`,
            width: 30,
            height: 30,
            centerX: am5.percent(50),
            centerY: am5.percent(50),
            tooltipText: "{condition}"
          })
        );

        return am5.Bullet.new(root, {
          sprite: container
        });
      }
      return null;
    });

    // ==============================================================================
    // 2.9) Legend
    // =====================================
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50)
      })
    );
    legend.data.setAll([highTempSeries, lowTempSeries]);

    // ==============================================================================
    // 2.10) Cursor
    // =====================================
    const cursor = am5xy.XYCursor.new(root, {});
    cursor.lineX.setAll({ visible: false, strokeOpacity: 0 });
    cursor.lineY.setAll({ visible: false, strokeOpacity: 0 });
    chart.set("cursor", cursor);

    // ==============================================================================
    // 2.11) Fetch dan Render Data
    // =====================================
    async function fetchAndRenderData(city) {
      const chartContainer = document.getElementById('chartContainer');
      chartContainer.classList.add('loading');

      try {
        const response = await fetch(`/api/weather?city=${encodeURIComponent(city)}`);
        console.log("API Response Status:", response.status);
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Fetched Data:", data);

        const { current_weather, forecast } = data;

        // Update Current Weather Section
        updateCurrentWeather(current_weather);

        // Update Forecast Section
        updateForecastSection(forecast);

        // Filter "N/A"
        const validData = forecast.filter(
          item =>
            item.high_temp !== "N/A" &&
            item.low_temp  !== "N/A" &&
            item.date      !== "N/A"
        );

        // Standardize date
        validData.forEach(item => {
          const [day, month, year] = item.date.split('/');
          item.date = `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
        });

        // Hapus duplicate date
        const uniqueData = [];
        const dateSet = new Set();
        validData.forEach(item => {
          if (!dateSet.has(item.date)) {
            uniqueData.push(item);
            dateSet.add(item.date);
          }
        });

        // Sort data by date
        uniqueData.sort((a, b) => {
          const parseDate = (dateStr) => new Date(dateStr.split('/').reverse().join('-'));
          return parseDate(a.date) - parseDate(b.date);
        });

        // Bind data to X-axis and series
        xAxis.data.setAll(uniqueData);
        highTempSeries.data.setAll(uniqueData);
        lowTempSeries.data.setAll(uniqueData);
        conditionSeries.data.setAll(
          uniqueData.map(item => ({
            date: item.date,
            low_temp: item.low_temp,
            condition: item.condition,
            icon: item.icon
          }))
        );

        // Dynamically set Y-axis range with buffer
        const maxHighTemp = Math.max(...uniqueData.map(item => parseFloat(item.high_temp)));
        const minLowTemp  = Math.min(...uniqueData.map(item => parseFloat(item.low_temp)));
        yAxis.set("max", maxHighTemp + 5);
        yAxis.set("min", minLowTemp - 5);

        // ======================================
        // HIGHLIGHT DULU, SKRG, BSK
        // ======================================

        let today = new Date();
        let day = String(today.getDate()).padStart(2, '0');
        let month = String(today.getMonth() + 1).padStart(2, '0');
        let year = today.getFullYear();
        let currentDateStr = `${day}/${month}/${year}`;

        let dateIndex = uniqueData.findIndex(item => item.date === currentDateStr);

        if (dateIndex !== -1) {
          let startIndex = Math.max(0, dateIndex - 1);
          let endIndex = Math.min(uniqueData.length - 1, dateIndex + 1);

          let startCategory = uniqueData[startIndex].date;
          let endCategory = uniqueData[endIndex].date;

          if (startCategory !== endCategory) {
            let highlightDataItem = xAxis.makeDataItem({
              category: startCategory,
              endCategory: endCategory
            });

            let range = xAxis.createAxisRange(highlightDataItem);
            range.setAll({
              categoryLocation: 0.5,
              endCategoryLocation: 0.5
            });

            // Style
            range.get("axisFill").setAll({
              fill: am5.color(0xffcc00),
              fillOpacity: 0.2,
              visible: true
            });

            if (range.get("label")) {
              range.get("label").set("forceHidden", true);
            }
          }
        }

        chartContainer.classList.remove('loading');
      } catch (err) {
        console.error("Error fetching weather data for chart:", err);
        const container = document.getElementById('chartContainer');
        container.innerText = "Failed to load chart data.";
        container.classList.remove('loading');
      }
    }

    // ==============================================================================
    // 3) Fetch Kota
    // =========================================
    const initialCity = $('#city-select').val();
    if (initialCity) {
      fetchAndRenderData(initialCity);
    } else {
      document.getElementById('chartContainer').innerText = "Please select a city to view weather data.";
      document.getElementById('chartContainer').classList.remove('loading');
    }

    // ==============================================================================
    // 4) Forecast Item Selection
    // =========================================
    const forecastContainer = document.querySelector('#forecast-section');
    const currentTemp       = document.querySelector('.current-temp .temp');
    const currentTempRange  = document.querySelector('.current-temp .temp-range');
    const currentCondition  = document.querySelector('.current-conditions .condition');
    const currentHumidityMax= document.querySelector('.current-conditions .humidity-max');
    const currentHumidityMin= document.querySelector('.current-conditions .humidity-min');
    const currentIcon       = document.querySelector('.current-icon');
    const currentDateElement= document.querySelector('.current-weather .current-date');

    if (forecastContainer) {
      forecastContainer.addEventListener('click', function(e) {
        handleForecastSelection(e);
      });
      forecastContainer.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' || e.key === ' ') {
          handleForecastSelection(e);
        }
      });
    }

    function handleForecastSelection(e) {
      const forecastItem = e.target.closest('.forecast-item');
      if (!forecastItem || forecastItem.classList.contains('na')) return;

      document.querySelectorAll('.forecast-item').forEach(el => el.classList.remove('selected'));
      forecastItem.classList.add('selected');

      const highTemp    = forecastItem.getAttribute('data-high-temp');
      const lowTemp     = forecastItem.getAttribute('data-low-temp');
      const condition   = forecastItem.getAttribute('data-condition');
      const humidityMax = forecastItem.getAttribute('data-humidity-max');
      const humidityMin = forecastItem.getAttribute('data-humidity-min');
      const icon        = forecastItem.getAttribute('data-icon');

      const dateElement = forecastItem.querySelector('.forecast-date .date');
      const date        = dateElement ? dateElement.textContent : "N/A";

      console.log(
        `Selected - High: ${highTemp}°C, Low: ${lowTemp}°C, Condition: ${condition}, ` +
        `Humidity Max: ${humidityMax}%, Humidity Min: ${humidityMin}%, ` +
        `Icon: ${icon}, Date: ${date}`
      );

      currentTemp.textContent       = (highTemp !== "N/A") ? `${highTemp}°C` : "N/A";
      currentTempRange.textContent  = (highTemp !== "N/A" && lowTemp !== "N/A") 
                                      ? `${highTemp}° / ${lowTemp}°` 
                                      : "N/A / N/A";
      currentCondition.textContent  = (condition !== "N/A") ? condition : "N/A";
      currentHumidityMax.textContent= (humidityMax !== "N/A") ? `${humidityMax}%` : "N/A";
      currentHumidityMin.textContent= (humidityMin !== "N/A") ? `${humidityMin}%` : "N/A";

      if (icon && icon !== "default.png") {
        currentIcon.src = `${STATIC_URL}images/${icon}`;
        currentIcon.alt = `${condition} icon`;
      } else {
        currentIcon.src = `${STATIC_URL}images/default.png`;
        currentIcon.alt = `Default icon`;
      }

      if (currentDateElement) {
        currentDateElement.textContent = (date !== "N/A") ? `Hari Ini: ${date}` : "N/A";
      }
    }

    // ==============================================================================
    // 5) City Selection
    // =========================================
    const citySelect = document.getElementById('city-select');
    if (citySelect) {
      $(citySelect).on('change', function() {
        const selectedCity = $(this).val();
        if (selectedCity) {
          fetchAndRenderData(selectedCity);

          // Optionally, update the URL without reloading
          const newURL = new URL(window.location);
          newURL.searchParams.set('city', selectedCity);
          window.history.pushState({ path: newURL.href }, '', newURL.href);
        }
      });
    }

    // ==============================================================================
    // 6) Update "Current Weather Section"
    // =========================================
    function updateCurrentWeather(current_weather) {
      const currentWeatherContainer = document.getElementById('current-weather');
      if (!currentWeatherContainer) return;

      const { high_temp, low_temp, condition, humidity_max, humidity_min, icon, date } = current_weather;

      // High Temp/Suhu_max
      const tempElement = currentWeatherContainer.querySelector('.current-temp .temp');
      tempElement.textContent = (high_temp !== "N/A") ? `${high_temp}°C` : "N/A";

      // Temp Range
      const tempRangeElement = currentWeatherContainer.querySelector('.current-temp .temp-range');
      tempRangeElement.textContent = (high_temp !== "N/A" && low_temp !== "N/A") 
                                      ? `${high_temp}° / ${low_temp}°` 
                                      : "N/A / N/A";

      // Condition/Awan
      const conditionElement = currentWeatherContainer.querySelector('.current-conditions .condition');
      conditionElement.textContent = (condition !== "N/A") ? condition : "N/A";

      // Kelembapan
      const humidityMaxElement = currentWeatherContainer.querySelector('.current-conditions .humidity-max');
      humidityMaxElement.textContent = (humidity_max !== "N/A") ? `${humidity_max}%` : "N/A";

      const humidityMinElement = currentWeatherContainer.querySelector('.current-conditions .humidity-min');
      humidityMinElement.textContent = (humidity_min !== "N/A") ? `${humidity_min}%` : "N/A";

      // Icon
      const iconElement = currentWeatherContainer.querySelector('.current-icon');
      if (icon && icon !== "default.png") {
        iconElement.src = `${STATIC_URL}images/${icon}`;
        iconElement.alt = `${condition} icon`;
      } else {
        iconElement.src = `${STATIC_URL}images/default.png`;
        iconElement.alt = `Default icon`;
      }

      // Date
      const dateElement = currentWeatherContainer.querySelector('.current-date');
      if (dateElement) {
        dateElement.textContent = (date !== "N/A") ? `Hari Ini: ${date}` : "N/A";
      }
    }

    // ==============================================================================
    // 7) Forecast Section
    // =========================================
    function updateForecastSection(forecast) {
      const forecastContainer = document.getElementById('forecast-section');
      if (!forecastContainer) return;

      forecastContainer.innerHTML = '';

      forecast.forEach(item => {
        const forecastItem = document.createElement('div');
        forecastItem.classList.add('forecast-item');
        if (item.date === "N/A" || item.high_temp === "N/A" || item.low_temp === "N/A") {
          forecastItem.classList.add('na');
        }

        forecastItem.setAttribute('data-high-temp', item.high_temp);
        forecastItem.setAttribute('data-low-temp', item.low_temp);
        forecastItem.setAttribute('data-condition', item.condition);
        forecastItem.setAttribute('data-humidity-max', item.humidity_max);
        forecastItem.setAttribute('data-humidity-min', item.humidity_min);
        forecastItem.setAttribute('data-icon', item.icon);

        // Date
        const forecastDate = document.createElement('div');
        forecastDate.classList.add('forecast-date');
        const weekdayDiv = document.createElement('div');
        weekdayDiv.classList.add('weekday');
        weekdayDiv.textContent = item.weekday;
        const dateDiv = document.createElement('div');
        dateDiv.classList.add('date');
        dateDiv.textContent = item.date;
        forecastDate.appendChild(weekdayDiv);
        forecastDate.appendChild(dateDiv);

        // Icon
        const forecastIcon = document.createElement('img');
        forecastIcon.classList.add('forecast-icon');
        forecastIcon.src = `${STATIC_URL}images/${item.icon}`;
        forecastIcon.alt = item.condition;

        // Suhue
        const forecastTemps = document.createElement('div');
        forecastTemps.classList.add('forecast-temps');
        const highTempSpan = document.createElement('span');
        highTempSpan.classList.add('high');
        highTempSpan.textContent = `${item.high_temp}°C`;
        const lowTempSpan = document.createElement('span');
        lowTempSpan.classList.add('low');
        lowTempSpan.textContent = `${item.low_temp}°C`;
        forecastTemps.appendChild(highTempSpan);
        forecastTemps.appendChild(lowTempSpan);

        // Forecast Item
        forecastItem.appendChild(forecastDate);
        forecastItem.appendChild(forecastIcon);
        forecastItem.appendChild(forecastTemps);

        // Untuk highlight tanggal skrg
        const today = new Date();
        const todayStr = today.toLocaleDateString('id-ID', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric' 
        });
        if (item.date === todayStr) {
          forecastItem.classList.add('selected');
        }

        forecastContainer.appendChild(forecastItem);
      });
    }

  });
});
