# The City Where Bike Share Isn't Shared
### DSC 106 Final Project @ UCSD

**An interactive data story revealing NYC's "transit deserts" by visualizing dense, car-free neighborhoods served by neither the subway nor the Citi Bike network.**

🔗 **[View Live Demo](https://musubi3.github.io/nyc-bike-share-access)**

---

## 📖 The Story
New York City has one of the largest bike-share systems in the world, but coverage is not evenly distributed. This project uses scrollytelling and spatial analysis to argue for the next phase of expansion.

The narrative is told in three parts:

1.  **The Pulse:** <br>Visualizing the massive scale of the current network (Jan 2025).

2.  **The Hidden Layer:** <br>Overlaying vehicle ownership data (ACS 2021) to reveal car-free neighborhoods in the outer boroughs that lack bike access.

3.  **The Next Frontier:** <br>Identifying 5 specific "Transit Deserts" (like Flushing and Brownsville), communities with high density, limited subway access, and no bike stations, that should be prioritized next.

<img src="https://i.postimg.cc/tCLpBz7C/image-2025-12-08-020912916.png" style="border-radius: 8px">

---

## 🛠 Tech Stack
* **Mapbox GL JS:** For vector tile rendering, 3D extrusion, and camera control.
* **D3.js (v7):** For data fetching (`d3.csv`, `d3.json`) and parsing.
* **Vanilla JS (ES6+):** Custom "Controller" architecture to manage map state.
* **HTML5/CSS3:** Responsive layout with glassmorphism UI.

---

## 📊 Data Sources
We utilized three primary datasets to build this analysis:

| Dataset | Source | Description |
| :--- | :--- | :--- |
| **Citi Bike Trip Data** | [Citi Bike System Data](https://citibikenyc.com/system-data) | Random sample of 100,000 trips from **January 2025**. Used to generate station density and usage metrics. |
| **Vehicle Availability** | [Census Reporter (ACS 2021)](https://censusreporter.org/) | "Household Size by Vehicles Available" (Table B08201) at the Census Tract level. Used to calculate Car-Free %. |
| **Subway Routes** | [NYU Spatial Data Repository](https://geo.nyu.edu/catalog/nyu-2451-60067) | Geospatial lines for all active NYC subway routes (2019). Used to visually prove transit gaps. |
| **Neighborhood Tabulation Areas** | [NYC Open Data](https://data.cityofnewyork.us/City-Government/2020-Census-Tracts/63ge-mke6/about_data) | GeoJSON boundaries for aggregating census tracts into recognizable neighborhoods. |