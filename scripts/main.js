// scripts/main.js

const width = 900;
const height = 650;

const svg = d3.select("#map")
  .attr("viewBox", [0, 0, width, height])
  .attr("preserveAspectRatio", "xMidYMid meet");

const tooltip = d3.select("#tooltip");
const timeSelect = d3.select("#time-filter");

// Load CSV (make sure this file is next to index.html, or update the path)
d3.csv("202301-citibike-50k.csv", d3.autoType).then(data => {
  // --- 1. Preprocess trips: extract hour from started_at ---
  data.forEach(d => {
    const started = d.started_at ? d.started_at.toString() : "";
    const hourStr = started.slice(11, 13); // "2023-01-01 13:36:56.305" -> "13"
    d.hour = +hourStr; // may become NaN if not parseable
  });

  // --- 2. Build station index from both start and end stations ---
  const stationMap = new Map();

  function ensureStation(id, name, lat, lng) {
    if (!id || lat == null || lng == null) return;
    const key = id.toString();
    if (!stationMap.has(key)) {
      stationMap.set(key, {
        id: key,
        name: name,
        lat: +lat,
        lng: +lng,
        startCount: 0,
        endCount: 0,
        total: 0,
        departShare: 0.5
      });
    }
  }

  data.forEach(d => {
    ensureStation(d.start_station_id, d.start_station_name, d.start_lat, d.start_lng);
    ensureStation(d.end_station_id, d.end_station_name, d.end_lat, d.end_lng);
  });

  const stations = Array.from(stationMap.values());

  // --- 3. Create a fake GeoJSON to fit the projection ---
  const stationFeatures = {
    type: "FeatureCollection",
    features: stations.map(s => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [s.lng, s.lat]
      }
    }))
  };

  const projection = d3.geoMercator()
    .fitSize([width, height], stationFeatures);

  // Scales (domains updated in update())
  const radiusScale = d3.scaleSqrt().range([2, 16]);
  const colorScale = d3.scaleSequential(d3.interpolateRdBu)
    .domain([1, 0]); // 1 = mostly departures, 0 = mostly arrivals

  // Helper to test if hour is in selected time bucket
  function inTimeBucket(hour, bucket) {
    if (isNaN(hour)) return bucket === "all";
    if (bucket === "all") return true;
    if (bucket === "morning") return hour >= 6 && hour < 12;
    if (bucket === "afternoon") return hour >= 12 && hour < 18;
    if (bucket === "evening") return hour >= 18 && hour < 24;
    if (bucket === "night") return hour >= 0 && hour < 6;
    return true;
  }

  // --- 4. Update function (called on load + whenever time bucket changes) ---
  function update() {
    const bucket = timeSelect.node().value;

    // Reset station counts
    stations.forEach(s => {
      s.startCount = 0;
      s.endCount = 0;
      s.total = 0;
      s.departShare = 0.5;
    });

    // Count trips in the selected bucket
    data.forEach(d => {
      if (!inTimeBucket(d.hour, bucket)) return;

      const startId = d.start_station_id && d.start_station_id.toString();
      const endId = d.end_station_id && d.end_station_id.toString();

      if (startId && stationMap.has(startId)) {
        const s = stationMap.get(startId);
        s.startCount += 1;
      }
      if (endId && stationMap.has(endId)) {
        const s = stationMap.get(endId);
        s.endCount += 1;
      }
    });

    // Compute totals + departure share
    stations.forEach(s => {
      s.total = s.startCount + s.endCount;
      if (s.total > 0) {
        s.departShare = s.startCount / s.total;
      } else {
        s.departShare = 0.5;
      }
    });

    const maxTotal = d3.max(stations, d => d.total) || 1;
    radiusScale.domain([0, maxTotal]);

    // Data join
    const circles = svg.selectAll(".station-circle")
      .data(stations, d => d.id);

    circles.join(
      enter => enter.append("circle")
        .attr("class", "station-circle")
        .attr("cx", d => projection([d.lng, d.lat])[0])
        .attr("cy", d => projection([d.lng, d.lat])[1])
        .attr("r", 0)
        .style("fill", d => colorScale(d.departShare))
        .call(enter =>
          enter.transition()
            .duration(600)
            .attr("r", d => radiusScale(d.total))
        ),
      updateSel => updateSel
        .call(updateSel =>
          updateSel.transition()
            .duration(600)
            .attr("r", d => radiusScale(d.total))
            .style("fill", d => colorScale(d.departShare))
        )
    )
    .on("mouseover", (event, d) => {
      if (d.total === 0) return;

      const departPct = (d.departShare * 100).toFixed(1);
      const arrivePct = (100 - departPct).toFixed(1);

      tooltip
        .style("opacity", 1)
        .html(`
          <strong>${d.name || "Unknown station"}</strong><br/>
          Total trips: ${d.total.toLocaleString()}<br/>
          Departures: ${d.startCount.toLocaleString()} (${departPct}%)
          <br/>
          Arrivals: ${d.endCount.toLocaleString()} (${arrivePct}%)
        `);

      const [x, y] = d3.pointer(event, document.body);
      tooltip
        .style("left", (x + 16) + "px")
        .style("top", (y + 16) + "px");
    })
    .on("mousemove", (event) => {
      const [x, y] = d3.pointer(event, document.body);
      tooltip
        .style("left", (x + 16) + "px")
        .style("top", (y + 16) + "px");
    })
    .on("mouseout", () => {
      tooltip.style("opacity", 0);
    });
  }

  // --- 5. Legend ---
  function drawLegend() {
    const legendGroup = svg.append("g")
      .attr("class", "legend")
      .attr("transform", "translate(20, 20)");

    legendGroup.append("text")
      .text("Circle size = # trips")
      .attr("y", 0)
      .attr("font-weight", "bold");

    const exampleValues = [20, 200, 1000];
    const yStart = 20;

    exampleValues.forEach((val, i) => {
      const r = radiusScale(val);
      const y = yStart + i * 30 + r;

      legendGroup.append("circle")
        .attr("cx", 20)
        .attr("cy", y)
        .attr("r", r)
        .attr("fill", "#aaa")
        .attr("stroke", "#555")
        .attr("stroke-width", 0.5)
        .attr("opacity", 0.6);

      legendGroup.append("text")
        .attr("x", 20 + r + 6)
        .attr("y", y + 4)
        .text(`${val} trips`);
    });

    const colorLegendY = yStart + exampleValues.length * 30 + 30;
    legendGroup.append("text")
      .text("Color = departures vs arrivals")
      .attr("y", colorLegendY)
      .attr("font-weight", "bold");

    const gradientId = "depart-arrive-gradient";
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", gradientId)
      .attr("x1", "0%").attr("x2", "100%")
      .attr("y1", "0%").attr("y2", "0%");

    gradient.append("stop").attr("offset", "0%").attr("stop-color", colorScale(0));
    gradient.append("stop").attr("offset", "50%").attr("stop-color", colorScale(0.5));
    gradient.append("stop").attr("offset", "100%").attr("stop-color", colorScale(1));

    const gradWidth = 160;
    const gradHeight = 10;

    legendGroup.append("rect")
      .attr("x", 0)
      .attr("y", colorLegendY + 8)
      .attr("width", gradWidth)
      .attr("height", gradHeight)
      .attr("fill", `url(#${gradientId})`);

    legendGroup.append("text")
      .attr("x", 0)
      .attr("y", colorLegendY + 28)
      .text("Mostly arrivals");

    legendGroup.append("text")
      .attr("x", gradWidth)
      .attr("y", colorLegendY + 28)
      .attr("text-anchor", "end")
      .text("Mostly departures");
  }

  // Draw legend once, then render data and set up interaction
  drawLegend();
  update();

  // Update on dropdown change
  timeSelect.on("change", update);
}).catch(err => {
  console.error("Error loading CSV:", err);
});
