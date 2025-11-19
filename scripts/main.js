// scripts/main.js
// Mapbox basemap + D3 overlay for Citi Bike station demand

// ============================
// 1. Mapbox initialization
// ============================

// 🔑 Put YOUR Mapbox access token here:
mapboxgl.accessToken = 'pk.eyJ1IjoiYW55dWFuIiwiYSI6ImNtaTBzd3o5ZTEya2Uycm9xMDZtNTdzZjcifQ.2KddgkMMu4gC-gn_ioRr7w';

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [-73.98, 40.75],          // NYC-ish center [lon, lat]
  zoom: 11.5,
  minZoom: 9,
  maxZoom: 16
});

// ============================
// 2. Globals / scales / helpers
// ============================

const tooltip = d3.select('#tooltip');
const timeSelect = d3.select('#time-filter');

let trips = [];
let stations = [];
let stationMap = new Map();

const radiusScale = d3.scaleSqrt().range([2, 18]); // circle sizes
const colorScale = d3.scaleSequential(d3.interpolateBrBG).domain([1, 0]); 
// 1 = mostly departures (green), 0 = mostly arrivals (brown)

let svg;       // D3 overlay SVG
let gStations; // group for station circles
let legendDrawn = false;

// Time-of-day helper
function inTimeBucket(hour, bucket) {
  if (isNaN(hour)) return bucket === 'all';
  if (bucket === 'all') return true;
  if (bucket === 'morning') return hour >= 6 && hour < 12;
  if (bucket === 'afternoon') return hour >= 12 && hour < 18;
  if (bucket === 'evening') return hour >= 18 && hour < 24;
  if (bucket === 'night') return hour >= 0 && hour < 6;
  return true;
}

// Project [lon, lat] to pixel coords using Mapbox
function projectPoint(station) {
  const p = map.project([station.lng, station.lat]);
  return { x: p.x, y: p.y };
}

// ============================
// 3. Map load: create SVG overlay + load data
// ============================

map.on('load', () => {
  // Create an SVG overlay inside Mapbox canvas container
  const container = map.getCanvasContainer();
  svg = d3.select(container)
    .append('svg')
    .attr('class', 'overlay-svg')
    .attr('width', '100%')
    .attr('height', '100%');

  gStations = svg.append('g').attr('class', 'stations');

  // Load Citi Bike sample CSV
  d3.csv('data/202301-citibike-50k.csv', d3.autoType).then(data => {
    trips = data;

    // Preprocess: parse started_at hour and build station map from trips
    trips.forEach(d => {
      // Parse hour from started_at
      const started = d.started_at ? d.started_at.toString() : '';
      const hourStr = started.slice(11, 13); // "2023-01-01 13:36:56.305" -> "13"
      d.hour = +hourStr;

      // Ensure start station
      if (d.start_station_id != null && d.start_lat != null && d.start_lng != null) {
        const key = d.start_station_id.toString();
        if (!stationMap.has(key)) {
          stationMap.set(key, {
            id: key,
            name: d.start_station_name,
            lat: +d.start_lat,
            lng: +d.start_lng,
            startCount: 0,
            endCount: 0,
            total: 0,
            departShare: 0.5
          });
        }
      }

      // Ensure end station
      if (d.end_station_id != null && d.end_lat != null && d.end_lng != null) {
        const key = d.end_station_id.toString();
        if (!stationMap.has(key)) {
          stationMap.set(key, {
            id: key,
            name: d.end_station_name,
            lat: +d.end_lat,
            lng: +d.end_lng,
            startCount: 0,
            endCount: 0,
            total: 0,
            departShare: 0.5
          });
        }
      }
    });

    stations = Array.from(stationMap.values());

    // Draw initial circles (r=0, positioned on map)
    gStations.selectAll('.station-circle')
      .data(stations, d => d.id)
      .join('circle')
      .attr('class', 'station-circle')
      .attr('cx', d => projectPoint(d).x)
      .attr('cy', d => projectPoint(d).y)
      .attr('r', 0);

    // First render
    update();

    // Update when dropdown changes
    timeSelect.on('change', update);

    // Update circle positions whenever the map moves/zooms
    map.on('move', updatePositions);
    map.on('zoom', updatePositions);
    map.on('resize', updatePositions);
  }).catch(err => {
    console.error('Error loading Citi Bike CSV:', err);
  });
});

// ============================
// 4. Update station counts + visuals
// ============================

function update() {
  if (!trips.length || !stations.length) return;

  const bucket = timeSelect.node().value;

  // Reset counts
  stations.forEach(s => {
    s.startCount = 0;
    s.endCount = 0;
    s.total = 0;
    s.departShare = 0.5;
  });

  // Count trips within selected time bucket
  trips.forEach(d => {
    if (!inTimeBucket(d.hour, bucket)) return;

    const startId = d.start_station_id != null ? d.start_station_id.toString() : null;
    const endId   = d.end_station_id   != null ? d.end_station_id.toString()   : null;

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

  // Draw / update circles
  const circles = gStations.selectAll('.station-circle')
    .data(stations, d => d.id);

  circles.join(
    enter => enter
      .append('circle')
      .attr('class', 'station-circle')
      .attr('cx', d => projectPoint(d).x)
      .attr('cy', d => projectPoint(d).y)
      .attr('r', 0)
      .call(enter => enter.transition()
        .duration(600)
        .attr('r', d => radiusScale(d.total))
        .style('fill', d => colorScale(d.departShare))
      ),
    updateSel => updateSel
      .call(updateSel => updateSel.transition()
        .duration(600)
        .attr('r', d => radiusScale(d.total))
        .style('fill', d => colorScale(d.departShare))
      )
  )
  .on('mouseover', handleMouseOver)
  .on('mousemove', handleMouseMove)
  .on('mouseout', handleMouseOut);

  // Place circles correctly after size changes
  updatePositions();

  if (!legendDrawn) {
    drawLegend();
    legendDrawn = true;
  }
}

// Reposition circles on map movement
function updatePositions() {
  if (!stations.length || !gStations) return;

  gStations.selectAll('.station-circle')
    .attr('cx', d => projectPoint(d).x)
    .attr('cy', d => projectPoint(d).y);
}

// ============================
// 5. Tooltip handlers
// ============================

function handleMouseOver(event, d) {
  if (d.total === 0) return;

  const departPct = (d.departShare * 100).toFixed(1);
  const arrivePct = (100 - departPct).toFixed(1);

  tooltip
    .style('opacity', 1)
    .html(`
      <strong>${d.name || 'Unknown station'}</strong><br/>
      Total trips: ${d.total.toLocaleString()}<br/>
      Departures: ${d.startCount.toLocaleString()} (${departPct}%)
      <br/>
      Arrivals: ${d.endCount.toLocaleString()} (${arrivePct}%)
    `);

  const [x, y] = d3.pointer(event, document.body);
  tooltip
    .style('left', (x + 16) + 'px')
    .style('top', (y + 16) + 'px');
}

function handleMouseMove(event) {
  const [x, y] = d3.pointer(event, document.body);
  tooltip
    .style('left', (x + 16) + 'px')
    .style('top', (y + 16) + 'px');
}

function handleMouseOut() {
  tooltip.style('opacity', 0);
}

// ============================
// 6. Legend in top-right of map
// ============================

function drawLegend() {
  const width = 900;  // matches your viewBox width approx
  const gLegend = svg.append('g')
    .attr('class', 'legend')
    .attr('transform', `translate(${width - 190}, 30)`);

  const exampleValues = [20, 100, 300];
  const yStart = 0;

  gLegend.append('text')
    .text('Circle size = # trips')
    .attr('y', yStart)
    .attr('font-weight', 'bold');

  exampleValues.forEach((val, i) => {
    const r = radiusScale(val);
    const y = yStart + 18 + i * 30 + r;

    gLegend.append('circle')
      .attr('cx', 20)
      .attr('cy', y)
      .attr('r', r)
      .attr('fill', '#aaaaaa')
      .attr('stroke', '#555')
      .attr('stroke-width', 0.5)
      .attr('opacity', 0.6);

    gLegend.append('text')
      .attr('x', 20 + r + 6)
      .attr('y', y + 4)
      .text(`${val} trips`);
  });

  const colorLegendY = yStart + 18 + exampleValues.length * 30 + 30;

  gLegend.append('text')
    .text('Color = departures vs arrivals')
    .attr('y', colorLegendY)
    .attr('font-weight', 'bold');

  const gradientId = 'depart-arrive-gradient';
  const defs = svg.append('defs');
  const gradient = defs.append('linearGradient')
    .attr('id', gradientId)
    .attr('x1', '0%').attr('x2', '100%')
    .attr('y1', '0%').attr('y2', '0%');

  gradient.append('stop').attr('offset', '0%').attr('stop-color', colorScale(0));   // arrivals
  gradient.append('stop').attr('offset', '50%').attr('stop-color', colorScale(0.5));
  gradient.append('stop').attr('offset', '100%').attr('stop-color', colorScale(1)); // departures

  const gradWidth = 150;
  const gradHeight = 10;

  gLegend.append('rect')
    .attr('x', 0)
    .attr('y', colorLegendY + 8)
    .attr('width', gradWidth)
    .attr('height', gradHeight)
    .attr('fill', `url(#${gradientId})`);

  gLegend.append('text')
    .attr('x', 0)
    .attr('y', colorLegendY + 28)
    .text('Mostly arrivals');

  gLegend.append('text')
    .attr('x', gradWidth)
    .attr('y', colorLegendY + 28)
    .attr('text-anchor', 'end')
    .text('Mostly departures');
}
