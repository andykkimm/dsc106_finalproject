import { drawEquityMap } from "./chart-equity-map.js";
import { drawStationMap } from "./chart-station-map.js";
import { drawHeatmap } from "./chart-heatmap.js";
import { drawDurationChart } from "./chart-duration.js";
import { drawStaticFlowMap } from "./chart-static-flow-map.js";
import { drawHourly } from "./chart-hourly.js";

document.addEventListener('DOMContentLoaded', async () => {
  drawStationMap();
  drawHeatmap();
  drawEquityMap();
  drawDurationChart();
  drawStaticFlowMap();
  drawHourly();
});