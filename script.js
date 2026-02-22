// ========================================
// CONFIGURATION & CONSTANTS
// ========================================
// Layout configuration for the visualization
const CONFIG = {
  margin: { top: 50, right: 150, bottom: 50, left: 100 },
  cellWidth: 90,
  cellHeight: 55,
  tooltipOffset: { x: 10, y: 28 },
  tooltipDelay: 200,
  fadeDuration: 500,
  transitionDuration: 500,
  monthCount: 12,
  dayRange: { min: 1, max: 31 },
  tempRange: { min: 0, max: 40 },
  yearRange: { start: 2008, end: 2017 },
  legendWidth: 20,
  legendHeight: 200,
  legendX: 30, // Offset after cells
  cellPadding: 2,
  cellRounding: 3,
  cellStrokeWidth: 2,
  lineStrokeWidth: 1.5,
};

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Toggle state for max/min temperature display
let isShowingMaxTemp = true;

// ========================================
// UTILITY FUNCTIONS
// ========================================

/**
 * Parses raw CSV data into structured format with date components
 * @param {Array} rawData - Raw CSV data from d3.csv()
 * @returns {Array} Parsed data with date, temperature, year, month, day fields
 */
function parseTemperatureData(rawData) {
  return rawData.map((d) => ({
    date: new Date(d.date),
    maxTemperature: +d.max_temperature,
    minTemperature: +d.min_temperature,
    year: new Date(d.date).getFullYear(),
    month: new Date(d.date).getMonth(),
    day: new Date(d.date).getDate(),
  }));
}

/**
 * Filters data to specified year range and extracts unique years
 * @param {Array} data - Parsed temperature data
 * @returns {Object} Object with filteredData array and years array
 */
function filterDataByYearRange(data) {
  const filteredData = data.filter(
    (d) => d.year >= CONFIG.yearRange.start && d.year <= CONFIG.yearRange.end,
  );
  const years = [...new Set(filteredData.map((d) => d.year))].sort(
    (a, b) => a - b,
  );
  return { filteredData, years };
}

/**
 * Groups temperature data by year and month, calculating monthly aggregates
 * @param {Array} data - Filtered temperature data
 * @param {Array} years - Array of unique years
 * @returns {Array} Monthly aggregated data with statistics
 */
function aggregateMonthlyData(data, years) {
  // Group data by year and month using d3.group
  const groupedData = d3.group(
    data,
    (d) => d.year,
    (d) => d.month,
  );

  const monthlyData = [];

  // Iterate through each year and month combination
  years.forEach((year) => {
    MONTHS.forEach((monthName, monthIndex) => {
      const monthRecords = groupedData.get(year)?.get(monthIndex) || [];

      if (monthRecords.length > 0) {
        monthlyData.push({
          year: year,
          month: monthIndex,
          monthName: monthName,
          maxTemp: d3.max(monthRecords, (d) => d.maxTemperature),
          minTemp: d3.min(monthRecords, (d) => d.minTemperature),
          avgMax: d3.mean(monthRecords, (d) => d.maxTemperature),
          avgMin: d3.mean(monthRecords, (d) => d.minTemperature),
          dailyData: monthRecords.sort((a, b) => a.day - b.day),
        });
      }
    });
  });

  return monthlyData;
}

/**
 * Creates a color scale for temperature values
 * Uses yellow-orange-red gradient for intuitive hot-to-cold mapping
 * @returns {Function} D3 sequential color scale
 */
function createColorScale() {
  return d3
    .scaleSequential()
    .domain([CONFIG.tempRange.min, CONFIG.tempRange.max])
    .interpolator(d3.interpolateYlOrRd);
}

/**
 * Calculates SVG dimensions based on data and configuration
 * @param {number} yearCount - Number of years in dataset
 * @returns {Object} Object with width and height properties
 */
function calculateSVGDimensions(yearCount) {
  const width =
    yearCount * CONFIG.cellWidth + CONFIG.margin.left + CONFIG.margin.right;
  const height =
    CONFIG.monthCount * CONFIG.cellHeight +
    CONFIG.margin.top +
    CONFIG.margin.bottom;
  return { width, height };
}

// ========================================
// VISUALIZATION FUNCTIONS
// ========================================

/**
 * Creates and configures the SVG element
 * @param {number} width - SVG width
 * @param {number} height - SVG height
 * @returns {Object} Object with svg and g (main group) selections
 */
function createSVGElement(width, height) {
  const svg = d3
    .select("#chart")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const mainGroup = svg
    .append("g")
    .attr("transform", `translate(${CONFIG.margin.left},${CONFIG.margin.top})`);

  return { svg, mainGroup };
}

/**
 * Creates and configures tooltip element
 * @returns {Function} D3 selection for tooltip div
 */
function createTooltip() {
  return d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);
}

/**
 * Renders year labels on the x-axis
 * @param {Function} mainGroup - D3 selection of main SVG group
 * @param {Array} years - Array of years to display
 */
function renderYearLabels(mainGroup, years) {
  mainGroup
    .selectAll(".year-label")
    .data(years)
    .enter()
    .append("text")
    .attr("class", "year-label")
    .attr("x", (d, i) => i * CONFIG.cellWidth + CONFIG.cellWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .text((d) => d);
}

/**
 * Renders month labels on the y-axis
 * @param {Function} mainGroup - D3 selection of main SVG group
 * @param {Array} months - Array of month names to display
 */
function renderMonthLabels(mainGroup) {
  mainGroup
    .selectAll(".month-label")
    .data(MONTHS)
    .enter()
    .append("text")
    .attr("class", "month-label")
    .attr("x", -10)
    .attr("y", (d, i) => i * CONFIG.cellHeight + CONFIG.cellHeight / 2)
    .attr("text-anchor", "end")
    .attr("dominant-baseline", "middle")
    .text((d) => d);
}

/**
 * Creates cell rectangles with color based on temperature and hover interactions
 * @param {Function} mainGroup - D3 selection of main SVG group
 * @param {Array} monthlyData - Aggregated monthly temperature data
 * @param {Function} colorScale - D3 color scale function
 * @param {Function} tooltip - D3 tooltip selection
 * @param {Array} years - Array of years
 * @returns {Function} D3 selection of cell groups
 */
function renderCells(mainGroup, monthlyData, colorScale, tooltip, years) {
  const cells = mainGroup
    .selectAll(".cell-group")
    .data(monthlyData)
    .enter()
    .append("g")
    .attr("class", "cell-group")
    .attr("transform", (d) => {
      const xIndex = years.indexOf(d.year);
      return `translate(${xIndex * CONFIG.cellWidth},${
        d.month * CONFIG.cellHeight
      })`;
    });

  // Create rectangle background for each cell
  cells
    .append("rect")
    .attr("class", "cell")
    .attr("width", CONFIG.cellWidth - 2 * CONFIG.cellPadding)
    .attr("height", CONFIG.cellHeight - 2 * CONFIG.cellPadding)
    .attr("x", CONFIG.cellPadding)
    .attr("y", CONFIG.cellPadding)
    .attr("rx", CONFIG.cellRounding)
    .attr("fill", (d) => colorScale(isShowingMaxTemp ? d.avgMax : d.avgMin))
    .on("mouseover", function (event, d) {
      // Show tooltip on hover
      tooltip.transition().duration(CONFIG.tooltipDelay).style("opacity", 0.9);
      tooltip
        .html(
          `Date: ${d.year}-${String(d.month + 1).padStart(2, "0")}<br/>
                   Max: ${d.maxTemp}°C<br/>Min: ${d.minTemp}°C`,
        )
        .style("left", event.pageX + CONFIG.tooltipOffset.x + "px")
        .style("top", event.pageY - CONFIG.tooltipOffset.y + "px");
    })
    .on("mouseout", function () {
      // Hide tooltip on mouse leave
      tooltip.transition().duration(CONFIG.fadeDuration).style("opacity", 0);
    });

  return cells;
}

/**
 * Renders mini line charts within each cell showing daily temperature variations
 * @param {Function} cells - D3 selection of cell groups
 */
function renderDailyLineCharts(cells) {
  cells.each(function (d) {
    const cell = d3.select(this);
    const dailyData = d.dailyData;

    // Skip if no daily data available
    if (dailyData.length === 0) return;

    // Create scales for the mini chart
    const xScale = d3
      .scaleLinear()
      .domain([CONFIG.dayRange.min, CONFIG.dayRange.max])
      .range([6, CONFIG.cellWidth - 10]);

    const yScale = d3
      .scaleLinear()
      .domain([CONFIG.tempRange.min, CONFIG.tempRange.max])
      .range([CONFIG.cellHeight - 8, 6]);

    // Create line generators for temperature data
    const maxTempLine = d3
      .line()
      .x((datum) => xScale(datum.day))
      .y((datum) => yScale(datum.maxTemperature))
      .curve(d3.curveMonotoneX);

    const minTempLine = d3
      .line()
      .x((datum) => xScale(datum.day))
      .y((datum) => yScale(datum.minTemperature))
      .curve(d3.curveMonotoneX);

    // Render maximum temperature line
    cell
      .append("path")
      .datum(dailyData)
      .attr("class", "max-line")
      .attr("d", maxTempLine);

    // Render minimum temperature line
    cell
      .append("path")
      .datum(dailyData)
      .attr("class", "min-line")
      .attr("d", minTempLine);
  });
}

/**
 * Creates color gradient legend showing temperature scale
 * @param {Function} mainGroup - D3 selection of main SVG group
 * @param {Function} svg - D3 selection of SVG element
 * @param {Function} colorScale - D3 color scale function
 * @param {number} yearCount - Number of years (for positioning)
 */
function renderLegend(mainGroup, svg, colorScale, yearCount) {
  const legendX = yearCount * CONFIG.cellWidth + CONFIG.legendX;

  // Create gradient definition for legend
  const defs = svg.append("defs");
  const gradient = defs
    .append("linearGradient")
    .attr("id", "legend-gradient")
    .attr("x1", "0%")
    .attr("y1", "100%")
    .attr("x2", "0%")
    .attr("y2", "0%");

  // Add color stops to gradient
  gradient
    .selectAll("stop")
    .data(d3.range(0, 1.1, 0.1))
    .enter()
    .append("stop")
    .attr("offset", (d) => d * 100 + "%")
    .attr("stop-color", (d) => colorScale(d * CONFIG.tempRange.max));

  // Create legend group
  const legend = mainGroup
    .append("g")
    .attr("transform", `translate(${legendX}, 50)`);

  // Draw gradient rectangle
  legend
    .append("rect")
    .attr("width", CONFIG.legendWidth)
    .attr("height", CONFIG.legendHeight)
    .style("fill", "url(#legend-gradient)");

  // Add temperature scale axis
  const legendScale = d3
    .scaleLinear()
    .domain([CONFIG.tempRange.min, CONFIG.tempRange.max])
    .range([CONFIG.legendHeight, 0]);

  const legendAxis = d3.axisRight(legendScale).ticks(5);

  legend
    .append("g")
    .attr("transform", `translate(${CONFIG.legendWidth}, 0)`)
    .call(legendAxis);

  // Add unit label
  legend
    .append("text")
    .attr("x", CONFIG.legendWidth / 2)
    .attr("y", -10)
    .attr("text-anchor", "middle")
    .style("font-size", "12px")
    .text("°C");
}

/**
 * Attaches toggle button functionality to switch between max/min temperature display
 * @param {Function} cells - D3 selection of cell groups
 * @param {Function} colorScale - D3 color scale function
 */
function attachToggleButtonHandler(cells, colorScale) {
  d3.select("#toggleBtn").on("click", function () {
    // Toggle display state
    isShowingMaxTemp = !isShowingMaxTemp;

    // Update button text
    d3.select(this).text(
      isShowingMaxTemp
        ? "Showing: Maximum Temperature"
        : "Showing: Minimum Temperature",
    );

    // Animate cell color changes
    cells
      .selectAll("rect.cell")
      .transition()
      .duration(CONFIG.transitionDuration)
      .attr("fill", (d) => colorScale(isShowingMaxTemp ? d.avgMax : d.avgMin));
  });
}

// ========================================
// MAIN EXECUTION
// ========================================

/**
 * Main function that orchestrates data loading and visualization rendering
 */
d3.csv("temperature_daily.csv").then(function (rawData) {
  // Step 1: Parse and clean the raw data
  const parsedData = parseTemperatureData(rawData);

  // Step 2: Filter data to specified year range
  const { filteredData, years } = filterDataByYearRange(parsedData);

  // Step 3: Aggregate data by month with statistics
  const monthlyData = aggregateMonthlyData(filteredData, years);

  // Step 4: Create color scale for temperature visualization
  const colorScale = createColorScale();

  // Step 5: Calculate SVG dimensions
  const { width, height } = calculateSVGDimensions(years.length);

  // Step 6: Create SVG and main group element
  const { svg, mainGroup } = createSVGElement(width, height);

  // Step 7: Create tooltip element
  const tooltip = createTooltip();

  // Step 8: Render axis labels
  renderYearLabels(mainGroup, years);
  renderMonthLabels(mainGroup);

  // Step 9: Render cells with color and interactivity
  const cells = renderCells(mainGroup, monthlyData, colorScale, tooltip, years);

  // Step 10: Add daily line charts to cells
  renderDailyLineCharts(cells);

  // Step 11: Create and render color legend
  renderLegend(mainGroup, svg, colorScale, years.length);

  // Step 12: Attach toggle button event handler
  attachToggleButtonHandler(cells, colorScale);
});
