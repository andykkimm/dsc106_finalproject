// scripts/odflow.js
// Origin–Destination (OD) flows: top-10 routes bar chart + spider map

// Basic config
const odBarWidth = 900;
const odBarHeight = 300;
const odBarMargin = { top: 30, right: 20, bottom: 30, left: 180 };

const odMapWidth = 900;
const odMapHeight = 300;
const odMapMargin = { top: 10, right: 10, bottom: 10, left: 10 };

const tooltip = d3.select("#tooltip");

// 1. Set up SVGs & groups
const odBarSvg = d3.select("#od-bar")
  .attr("viewBox", [0, 0, odBarWidth, odBarHeight])
  .attr("preserveAspectRatio", "xMidYMid meet");

const odBarInnerWidth = odBarWidth - odBarMargin.left - odBarMargin.right;
const odBarInnerHeight = odBarHeight - odBarMargin.top - odBarMargin.bottom;

const odBarG = odBarSvg.append("g")
  .attr("transform", `translate(${odBarMargin.left},${odBarMargin.top})`);

const odMapSvg = d3.select("#od-map")
  .attr("viewBox", [0, 0, odMapWidth, odMapHeight])
  .attr("preserveAspectRatio", "xMidYMid meet");

const odMapInnerWidth = odMapWidth - odMapMargin.left - odMapMargin.right;
const odMapInnerHeight = odMapHeight - odMapMargin.top - odMapMargin.bottom;

const odMapG = odMapSvg.append("g")
  .attr("transform", `translate(${odMapMargin.left},${odMapMargin.top})`);

// Globals that will be populated after data load
let odPairs = [];      // top-10 OD pairs
let odStations = [];   // subset of stations used in top-10
let stationById = new Map();
let proj;              // projection for map

// 2. Load data & build OD aggregates
d3.csv("202301-citibike-50k.csv", d3.autoType).then(data => {
  // Build a station lookup from trips
  data.forEach(d => {
    // start station
    if (d.start_station_id != null && d.start_lat != null && d.start_lng != null) {
      const key = d.start_station_id.toString();
      if (!stationById.has(key)) {
        stationById.set(key, {
          id: key,
          name: d.start_station_name,
          lat: +d.start_lat,
          lng: +d.start_lng
        });
      }
    }

    // end station
    if (d.end_station_id != null && d.end_lat != null && d.end_lng != null) {
      const key = d.end_station_id.toString();
      if (!stationById.has(key)) {
        stationById.set(key, {
          id: key,
          name: d.end_station_name,
          lat: +d.end_lat,
          lng: +d.end_lng
        });
      }
    }
  });

  // Rollup OD counts: (start_id, end_id) -> count
  const odRollup = d3.rollup(
    data.filter(d => d.start_station_id != null && d.end_station_id != null),
    v => v.length,
    d => d.start_station_id.toString(),
    d => d.end_station_id.toString()
  );

  // Flatten into array
  const allPairs = [];
  for (const [startId, innerMap] of odRollup.entries()) {
    for (const [endId, count] of innerMap.entries()) {
      if (!stationById.has(startId) || !stationById.has(endId)) continue;
      if (startId === endId) continue; // skip self-loops
      allPairs.push({
        startId,
        endId,
        count
      });
    }
  }

  // Sort & take top 10
  allPairs.sort((a, b) => d3.descending(a.count, b.count));
  odPairs = allPairs.slice(0, 10);

  // Build the subset of stations in these top-10 flows
  const usedIds = new Set();
  odPairs.forEach(p => {
    usedIds.add(p.startId);
    usedIds.add(p.endId);
  });
  odStations = Array.from(usedIds).map(id => stationById.get(id));

  // Compute projection bounds based on used stations
  const stationFeatures = {
    type: "FeatureCollection",
    features: odStations.map(s => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [s.lng, s.lat]
      }
    }))
  };

  proj = d3.geoMercator()
    .fitSize([odMapInnerWidth, odMapInnerHeight], stationFeatures);

  // Now render charts
  renderODBarChart();
  renderODMap();
}).catch(err => {
  console.error("Error loading CSV for OD flows:", err);
});

// 3. Bar chart rendering
function renderODBarChart() {
  if (!odPairs.length) return;

  // Build label: "Start → End"
  odPairs.forEach(p => {
    const startName = stationById.get(p.startId).name || p.startId;
    const endName = stationById.get(p.endId).name || p.endId;
    p.label = `${startName} → ${endName}`;
  });

  const xScale = d3.scaleLinear()
    .domain([0, d3.max(odPairs, d => d.count) || 1])
    .range([0, odBarInnerWidth])
    .nice();

  const yScale = d3.scaleBand()
    .domain(odPairs.map(d => d.label))
    .range([0, odBarInnerHeight])
    .padding(0.15);

  const xAxis = d3.axisBottom(xScale)
    .ticks(5)
    .tickFormat(d3.format(".2s"));

  const yAxis = d3.axisLeft(yScale)
    .tickFormat(d => {
      // shorten label if too long
      return d.length > 40 ? d.slice(0, 37) + "…" : d;
    });

  // Axes
  odBarG.append("g")
    .attr("class", "od-bar-axis x-axis")
    .attr("transform", `translate(0, ${odBarInnerHeight})`)
    .call(xAxis);

  odBarG.append("g")
    .attr("class", "od-bar-axis y-axis")
    .call(yAxis);

  // Axis label
  odBarG.append("text")
    .attr("x", odBarInnerWidth / 2)
    .attr("y", odBarInnerHeight + 24)
    .attr("text-anchor", "middle")
    .attr("font-size", 12)
    .attr("fill", "#444")
    .text("Number of trips (logically sorted)");

  // Bars
  odBarG.selectAll(".od-bar-rect")
    .data(odPairs, d => d.label)
    .join("rect")
      .attr("class", "od-bar-rect")
      .attr("x", 0)
      .attr("y", d => yScale(d.label))
      .attr("height", yScale.bandwidth())
      .attr("width", d => xScale(d.count))
      .on("mouseover", (event, d) => {
        highlightODPair(d);
        showODTooltip(event, d);
      })
      .on("mousemove", (event, d) => {
        showODTooltip(event, d);
      })
      .on("mouseout", () => {
        resetODHighlight();
        hideODTooltip();
      });
}

// 4. Map rendering (spider map of top-10 flows)
function renderODMap() {
  if (!odPairs.length || !proj) return;

  // Draw stations
  odMapG.selectAll(".od-map-station")
    .data(odStations, d => d.id)
    .join("circle")
      .attr("class", "od-map-station")
      .attr("r", 3)
      .attr("cx", d => proj([d.lng, d.lat])[0])
      .attr("cy", d => proj([d.lng, d.lat])[1]);

  const maxCount = d3.max(odPairs, d => d.count) || 1;
  const strokeScale = d3.scaleLinear()
    .domain([0, maxCount])
    .range([1, 6]);

  // Helper: curved path between stations (simple quadratic curve)
  function arcPath(startStation, endStation) {
    const [x1, y1] = proj([startStation.lng, startStation.lat]);
    const [x2, y2] = proj([endStation.lng, endStation.lat]);

    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;

    const dx = x2 - x1;
    const dy = y2 - y1;

    // Perpendicular offset for curve
    const curveOffset = 0.2;
    const cx = mx - curveOffset * dy;
    const cy = my + curveOffset * dx;

    return `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`;
  }

  // Draw flows
  odMapG.selectAll(".od-map-flow")
    .data(odPairs, d => d.label)
    .join("path")
      .attr("class", "od-map-flow")
      .attr("d", d => {
        const s = stationById.get(d.startId);
        const e = stationById.get(d.endId);
        return arcPath(s, e);
      })
      .attr("stroke-width", d => strokeScale(d.count))
      .on("mouseover", (event, d) => {
        highlightODPair(d);
        showODTooltip(event, d);
      })
      .on("mousemove", (event, d) => {
        showODTooltip(event, d);
      })
      .on("mouseout", () => {
        resetODHighlight();
        hideODTooltip();
      });
}

// 5. Highlight logic (sync bar + map)

function highlightODPair(pair) {
  // Highlight bar
  odBarG.selectAll(".od-bar-rect")
    .classed("highlight", d => d.label === pair.label);

  // Highlight flow
  odMapG.selectAll(".od-map-flow")
    .classed("highlight", d => d.label === pair.label);
}

function resetODHighlight() {
  odBarG.selectAll(".od-bar-rect").classed("highlight", false);
  odMapG.selectAll(".od-map-flow").classed("highlight", false);
}

// 6. Tooltip helpers

function showODTooltip(event, d) {
  const startName = stationById.get(d.startId).name || d.startId;
  const endName = stationById.get(d.endId).name || d.endId;

  tooltip
    .style("opacity", 1)
    .html(`
      <strong>${startName}</strong> → <strong>${endName}</strong><br/>
      Trips: ${d.count.toLocaleString()}
    `);

  const [x, y] = d3.pointer(event, document.body);
  tooltip
    .style("left", (x + 16) + "px")
    .style("top", (y + 16) + "px");
}

function hideODTooltip() {
  tooltip.style("opacity", 0);
}
