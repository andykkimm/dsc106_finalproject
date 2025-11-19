import { drawStationMap } from "./chart-station-map.js";
import { drawHeatmap } from "./heatmap.js";

document.addEventListener('DOMContentLoaded', async () => {
  drawStationMap();
  drawHeatmap();
});