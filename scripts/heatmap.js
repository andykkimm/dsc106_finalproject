export async function drawHeatmap() {
  // scripts/heatmap.js
  // Static Hour–Day Heatmap of Trips

  // Config
  const heatmapWidth = 900;
  const heatmapHeight = 280;
  const margin = { top: 30, right: 20, bottom: 40, left: 70 };

  // SVG setup
  const heatmapSvg = d3.select("#heatmap")
    .attr("viewBox", [0, 0, heatmapWidth, heatmapHeight])
    .attr("preserveAspectRatio", "xMidYMid meet");

  const innerWidth = heatmapWidth - margin.left - margin.right;
  const innerHeight = heatmapHeight - margin.top - margin.bottom;

  const heatmapG = heatmapSvg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Day-of-week ordering: Mon–Sun
  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // JS getDay(): 0=Sun,1=Mon,...6=Sat
  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  // Scales
  const xScale = d3.scaleBand()
    .domain(d3.range(24))         // 0–23 hours
    .range([0, innerWidth])
    .padding(0.05);

  const yScale = d3.scaleBand()
    .domain(dayOrder)             // 1,2,3,4,5,6,0 in that order
    .range([0, innerHeight])
    .padding(0.05);

  const colorScale = d3.scaleSequential(d3.interpolateYlOrRd); // domain set after data load

  // Axes
  const xAxis = d3.axisBottom(xScale)
    .tickValues(d3.range(0, 24, 2)) // label every 2 hours
    .tickFormat(d => d.toString());

  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => {
      const idx = dayOrder.indexOf(d);
      return dayLabels[idx];
    });

  // Append axes groups
  heatmapG.append("g")
    .attr("class", "heatmap-axis x-axis")
    .attr("transform", `translate(0, ${innerHeight})`);

  heatmapG.append("g")
    .attr("class", "heatmap-axis y-axis");

  // Axis labels
  heatmapG.append("text")
    .attr("x", innerWidth / 2)
    .attr("y", innerHeight + 32)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#444")
    .text("Hour of Day");

  heatmapG.append("text")
    .attr("x", -margin.left + 10)
    .attr("y", -10)
    .attr("text-anchor", "start")
    .attr("font-size", 12)
    .attr("fill", "#444")
    .text("Day of Week");

  // Load the Citi Bike data
  d3.csv("data/202301-citibike-50k.csv", d3.autoType).then(data => {
    // Aggregate trips by (dayOfWeek, hour)
    const countsMap = new Map(); // key: `${dow}-${hour}`, value: count

    data.forEach(d => {
      const startedStr = d.started_at ? d.started_at.toString() : "";
      if (!startedStr) return;

      // Parse date & hour
      const date = new Date(startedStr);
      if (isNaN(date)) return;

      const dow = date.getDay();      // 0=Sun,1=Mon,...6=Sat
      const hour = date.getHours();   // 0–23

      const key = `${dow}-${hour}`;
      const current = countsMap.get(key) || 0;
      countsMap.set(key, current + 1);
    });

    // Build an array of all (day, hour) cells so the grid is complete
    const heatmapData = [];
    dayOrder.forEach(dow => {
      d3.range(24).forEach(hour => {
        const key = `${dow}-${hour}`;
        const count = countsMap.get(key) || 0;
        heatmapData.push({ dow, hour, count });
      });
    });

    const maxCount = d3.max(heatmapData, d => d.count) || 1;
    colorScale.domain([0, maxCount]);

    // Draw cells
    heatmapG.selectAll(".heatmap-cell")
      .data(heatmapData)
      .join("rect")
      .attr("class", "heatmap-cell")
      .attr("x", d => xScale(d.hour))
      .attr("y", d => yScale(d.dow))
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", d => d.count === 0 ? "#f5f5f5" : colorScale(d.count));

    // Update axes
    heatmapG.select(".x-axis").call(xAxis);
    heatmapG.select(".y-axis").call(yAxis);

    // Optional: small legend
    const legendWidth = 140;
    const legendHeight = 10;
    const legendX = innerWidth - legendWidth - 10;
    const legendY = -20;

    const legend = heatmapG.append("g")
      .attr("transform", `translate(${legendX}, ${legendY})`);

    const defs = heatmapSvg.append("defs");
    const gradientId = "heatmap-gradient";

    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%").attr("x2", "100%")
      .attr("y1", "0%").attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(0));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(maxCount));

    legend.append("rect")
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", `url(#${gradientId})`);

    legend.append("text")
      .attr("x", 0)
      .attr("y", -4)
      .attr("font-size", 11)
      .attr("fill", "#444")
      .text("Trip count");

    legend.append("text")
      .attr("x", 0)
      .attr("y", legendHeight + 12)
      .attr("font-size", 10)
      .attr("fill", "#444")
      .text("Low");

    legend.append("text")
      .attr("x", legendWidth)
      .attr("y", legendHeight + 12)
      .attr("font-size", 10)
      .attr("fill", "#444")
      .attr("text-anchor", "end")
      .text("High");
  }).catch(err => {
    console.error("Error loading CSV for heatmap:", err);
  });

}