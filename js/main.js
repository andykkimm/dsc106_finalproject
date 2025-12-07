import { addStationLayer } from './layer-stations.js';
import { addEquityLayer } from './layer-equity.js';
import { addGapLayer } from './layer-gap.js';
import { addSubwayLayer } from './layer-subway.js';
import { addBuildingLayer } from './layer-buildings.js';

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYW55dWFuIiwiYSI6ImNtaTBzd3o5ZTEya2Uycm9xMDZtNTdzZjcifQ.2KddgkMMu4gC-gn_ioRr7w';

const STORY_STEPS = [
    {
        step: 1,
        title: "The Pulse of the City",
        content: "New York City has one of the largest bike-share systems in the world. " +
            "Every day, millions of trips trace the rhythms of how people move.<br><br>" +
            "Over <strong>2,000 stations</strong> light up the grid. <strong>Larger circles</strong> represent busier stations, " +
            "showing how the system is heavily concentrated in the commercial core.",
        btnText: "Next: The Hidden Layer →",
        centerDesktop: [-74, 40.74],
        centerMobile: [-73.96, 40.65],
        zoomDesktop: 11,
        zoomMobile: 9.5,
        pitch: 0,
        bearing: 0
    },
    {
        step: 2,
        title: "The Hidden Layer",
        content: "However, the system isn’t shared equally.<br><br>" +
            "Red areas represent neighborhoods where households are predominantly <strong>Car-Free</strong>.<br>" +
            "<div class='legend-bar'></div>" +
            "<div class='legend-labels'><span>High Car Ownership</span><span>High Car-Free %</span></div>" +
            "While the <strong>Subway (Gray Lines)</strong> serves the core well " +
            "notice how bike station coverage drops off sharply in the outer boroughs, " +
            "leaving the subway to do all the heavy lifting alone.",
        btnText: "Next: Bridging the Gap →",
        centerDesktop: [-74, 40.74],
        centerMobile: [-73.96, 40.47],
        zoomDesktop: 10,
        zoomMobile: 8.7,
        pitch: 0,
        bearing: 0
    },
    {
        step: 3,
        title: "Bridging the Gap",
        content: "To close this gap, the next phase must target the remaining 'Transit Deserts'.<br><br>" +
            "<span class='legend-item'><span class='legend-dot dot-cyan'></span> Future Expansion</span><br><br>" +
            "We’ve identified five new areas such as <strong>Flushing</strong> and <strong>Brownsville</strong>. " +
            "These are dense communities (over 140,000 households combined) with high car-free populations and limited train access, the perfect frontier for Citi Bike's next expansion.",

        btnText: "Restart ↺",
        centerDesktop: [-74, 40.68],
        centerMobile: [-73.96, 40.43],
        zoomDesktop: 10.5,
        zoomMobile: 9.5,
        pitch: 45,
        bearing: 0
    }
];

let currentStepIndex = 0;
let isStationsVisible = true;

mapboxgl.accessToken = MAPBOX_TOKEN;
const map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/light-v11',
    center: [-73.98, 40.75],
    zoom: 11,
    interactive: true
});

const ZONE_MAPPING = {
    "Coney Island-Sea Gate": "Coney Island & Brighton Beach",
    "Brighton Beach": "Coney Island & Brighton Beach",
    "East New York-City Line": "East New York & Spring Creek",
    "Spring Creek-Starrett City": "East New York & Spring Creek",
    "Soundview-Bruckner-Bronx River": "Soundview & Parkchester",
    "Parkchester": "Soundview & Parkchester"
};

map.on('load', async () => {
    try {
        const [stationsData, equityData, tractsGeoJSON, subwayGeoJSON] = await Promise.all([
            d3.csv('data/202501-citibike-sample.csv'),
            d3.csv('data/nyc_transit_equity.csv'),
            d3.json('data/nyc_tracts.geojson'),
            d3.json('data/nyc_subway.geojson')
        ]);

        const stationMap = new Map();
        stationsData.forEach(d => {
            if (!d.start_lng || !d.start_lat) return;
            const name = d.start_station_name;
            if (!stationMap.has(name)) {
                stationMap.set(name, {
                    name: name,
                    lat: +d.start_lat,
                    lng: +d.start_lng,
                    count: 0,
                    member: 0,
                    casual: 0
                });
            }
            const station = stationMap.get(name);
            station.count++;
            if (d.member_casual === 'member') station.member++;
            else station.casual++;
        });

        const stationsGeoJSON = {
            type: 'FeatureCollection',
            features: Array.from(stationMap.values()).map(s => ({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [s.lng, s.lat] },
                properties: {
                    name: s.name,
                    count: s.count,
                    member: s.member,
                }
            }))
        };

        const equityLookup = new Map();
        equityData.forEach(row => {
            equityLookup.set(String(row.GEOID), {
                pct: +row.pct_no_vehicle,
                households: +row.total_households
            });
        });



        const neighborhoodStats = new Map();

        tractsGeoJSON.features.forEach(feature => {
            const geoid = feature.properties.geoid || feature.properties.GEOID;
            const data = equityLookup.get(String(geoid));

            feature.properties.pct_car_free = data ? data.pct : 0;
            feature.properties.total_households = data ? data.households : 0;

            const nta = feature.properties.ntaname;
            if (nta) {
                if (!neighborhoodStats.has(nta)) {
                    neighborhoodStats.set(nta, { households: 0, carFreeHouseholds: 0 });
                }
                const stats = neighborhoodStats.get(nta);
                const households = feature.properties.total_households;
                const carFreePct = feature.properties.pct_car_free;

                stats.households += households;
                stats.carFreeHouseholds += (households * carFreePct);
            }
        });

        tractsGeoJSON.features.forEach(feature => {
            const nta = feature.properties.ntaname;
            const stats = neighborhoodStats.get(nta);

            if (stats && stats.households > 0) {
                feature.properties.nta_total_households = stats.households;
                feature.properties.nta_avg_car_free = stats.carFreeHouseholds / stats.households;
            } else {
                feature.properties.nta_total_households = 0;
                feature.properties.nta_avg_car_free = 0;
            }
        });

        const zoneStats = new Map();

        tractsGeoJSON.features.forEach(feature => {
            const geoid = feature.properties.geoid || feature.properties.GEOID;
            const data = equityLookup.get(String(geoid));

            feature.properties.pct_car_free = data ? data.pct : 0;
            feature.properties.total_households = data ? data.households : 0;

            const nta = feature.properties.ntaname;

            const zoneName = ZONE_MAPPING[nta] || nta;

            if (zoneName) {
                if (!zoneStats.has(zoneName)) {
                    zoneStats.set(zoneName, { households: 0, carFreeHouseholds: 0 });
                }
                const stats = zoneStats.get(zoneName);
                const households = feature.properties.total_households;
                const carFreePct = feature.properties.pct_car_free;

                stats.households += households;
                stats.carFreeHouseholds += (households * carFreePct);
            }
        });

        tractsGeoJSON.features.forEach(feature => {
            const nta = feature.properties.ntaname;
            const zoneName = ZONE_MAPPING[nta] || nta; 

            const stats = zoneStats.get(zoneName);

            if (stats && stats.households > 0) {
                feature.properties.display_name = zoneName; 
                feature.properties.display_households = stats.households;
                feature.properties.display_avg_car_free = stats.carFreeHouseholds / stats.households;
            } else {
                feature.properties.display_name = nta;
                feature.properties.display_households = 0;
                feature.properties.display_avg_car_free = 0;
            }
        });

        addEquityLayer(map, tractsGeoJSON);
        addSubwayLayer(map, subwayGeoJSON);
        addGapLayer(map);
        addStationLayer(map, stationsGeoJSON);
        addBuildingLayer(map);

        updateStoryUI(0);

        const loader = document.getElementById('loader');
        if (loader) {
            loader.style.opacity = '0';
            setTimeout(() => {
                loader.style.display = 'none';
            }, 500);
        }
    } catch (error) {
        console.error("Error loading data:", error);
        alert("Failed to load map data. Please try refreshing.");
    }
});

function updateStoryUI(index) {
    const step = STORY_STEPS[index];

    document.getElementById('step-count').innerText = `Part ${index + 1} of ${STORY_STEPS.length}`;
    document.getElementById('story-title').innerText = step.title;
    document.getElementById('story-text').innerHTML = step.content;
    document.getElementById('next-btn').innerText = step.btnText;
    document.getElementById('prev-btn').disabled = (index === 0);

    const toggleContainer = document.getElementById('layer-toggles');
    if (toggleContainer) {
        if (step.step === 2 || step.step === 3) {
            toggleContainer.style.display = 'block';
        } else {
            toggleContainer.style.display = 'none';
            if (step.step === 1) {
                isStationsVisible = true;
                const toggleInput = document.getElementById('station-toggle');
                if (toggleInput) toggleInput.checked = true;
            }
        }
    }

    updateMapLayers();
    map.flyTo({
        center: getResponsiveCenter(step),
        zoom: getResponsiveZoom(step),
        speed: 1.5,
        pitch: step.pitch || 0,
        bearing: step.bearing || 0
    });
}

function updateMapLayers() {
    const stepNum = STORY_STEPS[currentStepIndex].step;

    const stepSettings = {
        1: { stationMax: 0.8, equity: 0, gapLine: 0, gapFill: 0, subway: 0, buildings: 0.3 },
        2: { stationMax: 0.4, equity: 0.7, gapLine: 0, gapFill: 0, subway: 0.4, buildings: 0.6 },
        3: { stationMax: 0.1, equity: 0.4, gapLine: 0.7, gapFill: 0.4, subway: 0.3, buildings: 0.6 }
    };

    const settings = stepSettings[stepNum];
    const finalStationOpacity = isStationsVisible ? settings.stationMax : 0;

    if (map.getLayer('stations-points')) {
        map.setPaintProperty('stations-points', 'circle-opacity', finalStationOpacity);
        map.setPaintProperty('stations-points', 'circle-stroke-opacity', finalStationOpacity);
    }
    if (map.getLayer('equity-fill')) {
        map.setPaintProperty('equity-fill', 'fill-opacity', settings.equity);
    }
    if (map.getLayer('gap-highlight')) {
        map.setPaintProperty('gap-highlight', 'line-opacity', settings.gapLine);
    }
    if (map.getLayer('gap-fill')) {
        map.setPaintProperty('gap-fill', 'fill-opacity', settings.gapFill);
    }
    if (map.getLayer('subway-lines-draw')) {
        map.setPaintProperty('subway-lines-draw', 'line-opacity', settings.subway);
    }
    if (map.getLayer('3d-buildings')) {
        map.setPaintProperty('3d-buildings', 'fill-extrusion-opacity', settings.buildings);
    }
}

function getResponsiveZoom(step) {
    if (window.innerWidth < 600) {
        return step.zoomMobile;
    } else {
        return step.zoomDesktop;
    }
}

function getResponsiveCenter(step) {
    if (window.innerWidth < 600) {
        return step.centerMobile;
    } else {
        return step.centerDesktop;
    }
}

const recenterBtn = document.getElementById('recenter-btn');
if (recenterBtn) {
    recenterBtn.addEventListener('click', () => {
        const step = STORY_STEPS[currentStepIndex];
        map.flyTo({
            center: getResponsiveCenter(step),
            zoom: getResponsiveZoom(step),
            pitch: step.pitch || 0,
            bearing: step.bearing || 0,
            speed: 1.5
        });
    });
}

const toggleInput = document.getElementById('station-toggle');
if (toggleInput) {
    toggleInput.addEventListener('change', (e) => {
        isStationsVisible = e.target.checked;
        updateMapLayers();
    });
}

document.getElementById('next-btn').addEventListener('click', () => {
    if (currentStepIndex < STORY_STEPS.length - 1) {
        currentStepIndex++;
        updateStoryUI(currentStepIndex);
    } else {
        currentStepIndex = 0;
        updateStoryUI(currentStepIndex);
    }
});

document.getElementById('prev-btn').addEventListener('click', () => {
    if (currentStepIndex > 0) {
        currentStepIndex--;
        updateStoryUI(currentStepIndex);
    }
});

const infoBtn = document.getElementById('info-btn');
const metaCard = document.getElementById('project-meta');
const closeBtn = document.getElementById('meta-close-btn');
const overlay = document.getElementById('modal-overlay'); 

if (infoBtn && metaCard && overlay) {
    infoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        metaCard.classList.toggle('active');
        overlay.classList.toggle('active'); 
    });
}

function closeModal() {
    if (metaCard) metaCard.classList.remove('active');
    if (overlay) overlay.classList.remove('active');
}

if (closeBtn) {
    closeBtn.addEventListener('click', closeModal);
}

if (overlay) {
    overlay.addEventListener('click', closeModal);
}