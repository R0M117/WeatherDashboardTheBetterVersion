document.addEventListener("DOMContentLoaded", function() {
  // ==============================================================================
  // 1) Initialize Select2 for City Dropdown
  // ==============================================================================
  $('.select2').select2({
    placeholder: "Pilih Kota",
    allowClear: true,
    width: '100%',
  });

  // Prevent form submission if the select is inside a form.
  const $cityForm = $('#city-select').closest('form');
  if ($cityForm.length > 0) {
    $cityForm.on('submit', function(e) {
      e.preventDefault();
    });
  }

  // ==============================================================================
  // 2) Initialize amCharts v5
  // ==============================================================================
  am5.ready(function() {
    const root = am5.Root.new("chartContainer");
    root.setThemes([ am5themes_Animated.new(root) ]);
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: "none",
        wheelY: "none",
        layout: root.verticalLayout
      })
    );

    // X-axis setup
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
      am5xy.CategoryAxis.new(root, { categoryField: "date", renderer: xRenderer })
    );
    xRenderer.labels.template.setAll({ 
      location: 0.5, 
      rotation: -45, 
      maxWidth: 80, 
      truncate: true, 
      tooltipText: "{category}" 
    });
    xRenderer.grid.template.setAll({ location: 0.5 });

    // Y-axis setup
    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, { renderer: am5xy.AxisRendererY.new(root, {}), min: 0 })
    );

    // High Temp Series
    const highTempSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "High Temp",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "high_temp",
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, { labelText: "{valueY}°C" }),
        stacked: false 
      })
    );
    highTempSeries.fills.template.setAll({ fill: am5.color(0xff0000), fillOpacity: 0.2, visible: true });
    highTempSeries.strokes.template.setAll({ strokeWidth: 2, stroke: am5.color(0xff0000) });
    highTempSeries.bullets.push(function() {
      return am5.Bullet.new(root, { sprite: am5.Circle.new(root, { radius: 3, fill: highTempSeries.get("stroke") }) });
    });

    // Low Temp Series
    const lowTempSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Low Temp",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "low_temp",
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, { labelText: "{valueY}°C" }),
        stacked: false 
      })
    );
    lowTempSeries.fills.template.setAll({ fillOpacity: 0.2, visible: true });
    lowTempSeries.strokes.template.setAll({ strokeWidth: 2, stroke: am5.color(0x0000ff) });
    lowTempSeries.bullets.push(function() {
      return am5.Bullet.new(root, { sprite: am5.Circle.new(root, { radius: 3, fill: lowTempSeries.get("stroke") }) });
    });

    // Weather Icon Series
    const conditionSeries = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: "Condition",
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: "low_temp",
        categoryXField: "date",
        tooltip: am5.Tooltip.new(root, { labelText: "{condition}" })
      })
    );
    conditionSeries.strokes.template.setAll({ strokeOpacity: 0 });
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
        return am5.Bullet.new(root, { sprite: container });
      }
      return null;
    });

    // Legend & Cursor
    const legend = chart.children.push(am5.Legend.new(root, { centerX: am5.percent(50), x: am5.percent(50) }));
    legend.data.setAll([highTempSeries, lowTempSeries]);
    const cursor = am5xy.XYCursor.new(root, {});
    cursor.lineX.setAll({ visible: false, strokeOpacity: 0 });
    cursor.lineY.setAll({ visible: false, strokeOpacity: 0 });
    chart.set("cursor", cursor);

    // Global variables for chart highlighting.
    window.xAxis = xAxis;
    window.chartHighlightRange = null;
    window.chartData = [];

    // --------------------------------------------------------------------------
    // Function: updateChartHighlight
    // Updates the chart highlight based on the selected forecast date (format: "dd Mon yyyy").
    // --------------------------------------------------------------------------
    function updateChartHighlight(selectedDateStr) {
      if (window.xAxis && window.chartData) {
        if (window.chartHighlightRange) {
          window.chartHighlightRange.dispose();
          window.chartHighlightRange = null;
        }
        let index = window.chartData.findIndex(item => item.date === selectedDateStr);
        if (index !== -1) {
          let startIndex = Math.max(0, index - 1);
          let endIndex = Math.min(window.chartData.length - 1, index + 1);
          let startCategory = window.chartData[startIndex].date;
          let endCategory = window.chartData[endIndex].date;
          if (startCategory !== endCategory) {
            let highlightDataItem = window.xAxis.makeDataItem({ category: startCategory, endCategory: endCategory });
            window.chartHighlightRange = window.xAxis.createAxisRange(highlightDataItem);
            window.chartHighlightRange.setAll({ categoryLocation: 0.5, endCategoryLocation: 0.5 });
            window.chartHighlightRange.get("axisFill").setAll({ fill: am5.color(0xffcc00), fillOpacity: 0.2, visible: true });
            if (window.chartHighlightRange.get("label")) {
              window.chartHighlightRange.get("label").set("forceHidden", true);
            }
          }
        }
      }
    }

    // ==============================================================================
    // Function: fetchAndRenderData
    // Fetch forecast data via AJAX. Accepts an optional baseDate parameter.
    // ==============================================================================
    async function fetchAndRenderData(city, baseDate = null) {
      const chartContainer = document.getElementById('chartContainer');
      chartContainer.classList.add('loading');
      try {
        let url = `/api/weather?city=${encodeURIComponent(city)}`;
        if (baseDate) {
          url += `&date=${encodeURIComponent(baseDate)}`;
        }
        const response = await fetch(url);
        console.log("API Response Status:", response.status);
        if (!response.ok) {
          throw new Error(`Network response was not ok: ${response.statusText}`);
        }
        const data = await response.json();
        console.log("Fetched Data:", data);
        const { current_weather, forecast } = data;
        window.forecastData = forecast;
        updateCurrentWeather(current_weather);
        updateForecastSection(forecast);

        // Process valid data for the chart.
        const validData = forecast.filter(item => item.high_temp !== "N/A" && item.low_temp !== "N/A" && item.date !== "N/A");
        const uniqueData = [];
        const dateSet = new Set();
        validData.forEach(item => {
          if (!dateSet.has(item.date)) {
            uniqueData.push(item);
            dateSet.add(item.date);
          }
        });
        uniqueData.sort((a, b) => {
          const parseDate = (dateStr) => {
            const [day, month, year] = dateStr.split(' ');
            const monthMap = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
            return new Date(`${year}-${monthMap[month]}-${day}`);
          };
          return parseDate(a.date) - parseDate(b.date);
        });
        xAxis.data.setAll(uniqueData);
        highTempSeries.data.setAll(uniqueData);
        lowTempSeries.data.setAll(uniqueData);
        conditionSeries.data.setAll(uniqueData.map(item => ({
          date: item.date,
          low_temp: item.low_temp,
          condition: item.condition,
          icon: item.icon
        })));
        const maxHighTemp = Math.max(...uniqueData.map(item => parseFloat(item.high_temp)));
        const minLowTemp  = Math.min(...uniqueData.map(item => parseFloat(item.low_temp)));
        yAxis.set("max", maxHighTemp + 5);
        yAxis.set("min", minLowTemp - 5);
        window.chartData = uniqueData;
        updateChartHighlight(current_weather.date);
        chartContainer.classList.remove('loading');
      } catch (err) {
        console.error("Error fetching weather data for chart:", err);
        const container = document.getElementById('chartContainer');
        container.innerText = "Failed to load chart data.";
        container.classList.remove('loading');
      }
    }

    // ==============================================================================
    // Initial Load: Fetch data for the initially selected city.
    // ==============================================================================
    const initialCity = $('#city-select').val();
    if (initialCity) {
      fetchAndRenderData(initialCity);
    } else {
      document.getElementById('chartContainer').innerText = "Please select a city to view weather data.";
      document.getElementById('chartContainer').classList.remove('loading');
    }

    // ==============================================================================
    // Forecast Item Selection (click/keypress)
    // ==============================================================================
    const forecastContainer = document.querySelector('#forecast-section');
    const currentTempEl = document.querySelector('.current-temp .temp');
    const currentTempRangeEl = document.querySelector('.current-temp .temp-range');
    // Note: Use the new selector for condition inside .current-icon-group.
    const currentConditionEl = document.querySelector('.current-icon-group .condition');
    const currentHumidityMaxEl = document.querySelector('.current-conditions .humidity-max');
    const currentHumidityMinEl = document.querySelector('.current-conditions .humidity-min');
    const currentIconEl = document.querySelector('.current-icon');
    const currentDateElement = document.querySelector('.current-weather .current-date');

    if (forecastContainer) {
      forecastContainer.addEventListener('click', function(e) { handleForecastSelection(e); });
      forecastContainer.addEventListener('keypress', function(e) { if (e.key === 'Enter' || e.key === ' ') { handleForecastSelection(e); } });
    }

    function handleForecastSelection(e) {
      const forecastItem = e.target.closest('.forecast-item');
      if (!forecastItem || forecastItem.classList.contains('na')) return;
      document.querySelectorAll('.forecast-item').forEach(el => el.classList.remove('selected'));
      forecastItem.classList.add('selected');

      const highTemp = forecastItem.getAttribute('data-high-temp');
      const lowTemp = forecastItem.getAttribute('data-low-temp');
      const condition = forecastItem.getAttribute('data-condition');
      const humidityMax = forecastItem.getAttribute('data-humidity-max');
      const humidityMin = forecastItem.getAttribute('data-humidity-min');
      const icon = forecastItem.getAttribute('data-icon');
      const date_iso = forecastItem.getAttribute('data-date-iso');

      const dateEl = forecastItem.querySelector('.forecast-date .date');
      const date = dateEl ? dateEl.textContent : "N/A";

      currentTempEl.textContent = (highTemp !== "N/A") ? `${highTemp}°C` : "N/A";
      currentTempRangeEl.textContent = (highTemp !== "N/A" && lowTemp !== "N/A") ? `${highTemp}° / ${lowTemp}°` : "N/A / N/A";
      currentConditionEl.textContent = (condition !== "N/A") ? condition : "N/A";
      currentHumidityMaxEl.textContent = (humidityMax !== "N/A") ? `${humidityMax}%` : "N/A";
      currentHumidityMinEl.textContent = (humidityMin !== "N/A") ? `${humidityMin}%` : "N/A";
      if (icon && icon !== "default.png") {
        currentIconEl.src = `${STATIC_URL}images/${icon}`;
        currentIconEl.alt = `${condition} icon`;
      } else {
        currentIconEl.src = `${STATIC_URL}images/default.png`;
        currentIconEl.alt = `Default icon`;
      }
      // Compare forecast date with device date.
      const currentDeviceDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      if (currentDateElement) {
        if (date !== "N/A") {
          currentDateElement.textContent = (date === currentDeviceDate) ? `Hari Ini: ${date}` : `Hari Lain: ${date}`;
        } else {
          currentDateElement.textContent = "N/A";
        }
      }
      const datePicker = document.getElementById('date-picker');
      if (datePicker) {
        datePicker.value = date_iso;
      }
      updateChartHighlight(date);
    }

    // ==============================================================================
    // City Selection Change: Preserve selected date and do not reload the page.
    // ==============================================================================
    const citySelectEl = document.getElementById('city-select');
    if (citySelectEl) {
      $(citySelectEl).on('change', function(e) {
        e.preventDefault();
        e.stopPropagation();
        const selectedCity = $(this).val();
        if (selectedCity) {
          const datePicker = document.getElementById('date-picker');
          let selectedDate = datePicker ? datePicker.value : null;
          fetchAndRenderData(selectedCity, selectedDate);
          const newURL = new URL(window.location);
          newURL.searchParams.set('city', selectedCity);
          if (selectedDate) {
            newURL.searchParams.set('date', selectedDate);
          }
          window.history.pushState({ path: newURL.href }, '', newURL.href);
        }
        return false;
      });
    }

    // ==============================================================================
    // Date Picker Change Event: Refresh forecast for chosen date.
    // ==============================================================================
    const datePickerEl = document.getElementById('date-picker');
    if (datePickerEl) {
      datePickerEl.addEventListener('change', function() {
        const selectedIso = this.value; // Format: YYYY-MM-DD
        const city = $('#city-select').val();
        fetchAndRenderData(city, selectedIso);
      });
    }

    // ==============================================================================
    // Update Current Weather Section (and update the date picker)
    // ==============================================================================
    function updateCurrentWeather(current_weather) {
      const currentWeatherContainer = document.getElementById('current-weather');
      if (!currentWeatherContainer) return;
      const { high_temp, low_temp, condition, humidity_max, humidity_min, icon, date, date_iso } = current_weather;
      const tempElement = currentWeatherContainer.querySelector('.current-temp .temp');
      tempElement.textContent = (high_temp !== "N/A") ? `${high_temp}°C` : "N/A";
      const tempRangeElement = currentWeatherContainer.querySelector('.current-temp .temp-range');
      tempRangeElement.textContent = (high_temp !== "N/A" && low_temp !== "N/A") ? `${high_temp}° / ${low_temp}°` : "N/A / N/A";
      // Use the new selector for condition inside the current-icon-group.
      const conditionElement = currentWeatherContainer.querySelector('.current-icon-group .condition');
      conditionElement.textContent = (condition !== "N/A") ? condition : "N/A";
      const humidityMaxElement = currentWeatherContainer.querySelector('.current-conditions .humidity-max');
      humidityMaxElement.textContent = (humidity_max !== "N/A") ? `${humidity_max}%` : "N/A";
      const humidityMinElement = currentWeatherContainer.querySelector('.current-conditions .humidity-min');
      humidityMinElement.textContent = (humidity_min !== "N/A") ? `${humidity_min}%` : "N/A";
      const iconElement = currentWeatherContainer.querySelector('.current-icon');
      if (icon && icon !== "default.png") {
        iconElement.src = `${STATIC_URL}images/${icon}`;
        iconElement.alt = `${condition} icon`;
      } else {
        iconElement.src = `${STATIC_URL}images/default.png`;
        iconElement.alt = `Default icon`;
      }
      const dateElement = currentWeatherContainer.querySelector('.current-date');
      const currentDeviceDate = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      if (dateElement) {
        if (date !== "N/A") {
          dateElement.textContent = (date === currentDeviceDate) ? `Hari Ini: ${date}` : `Hari Lain: ${date}`;
        } else {
          dateElement.textContent = "N/A";
        }
      }
      const dp = document.getElementById('date-picker');
      if (dp && date_iso) {
        dp.value = date_iso;
      }
    }

    // ==============================================================================
    // Update Forecast Section
    // ==============================================================================
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
        forecastItem.setAttribute('data-date-iso', item.date_iso);
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
        const forecastIcon = document.createElement('img');
        forecastIcon.classList.add('forecast-icon');
        forecastIcon.src = `${STATIC_URL}images/${item.icon}`;
        forecastIcon.alt = item.condition;
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
        forecastItem.appendChild(forecastDate);
        forecastItem.appendChild(forecastIcon);
        forecastItem.appendChild(forecastTemps);
        // Fallback: highlight forecast matching today's date.
        const today = new Date();
        const todayStr = today.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        if (item.date === todayStr) {
          forecastItem.classList.add('selected');
        }
        forecastContainer.appendChild(forecastItem);
      });
    }
  });
});
