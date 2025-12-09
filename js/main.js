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
        content:
            "New York City runs on movement, and Citi Bike has become a defining rhythm of that motion. " +
            "With over <strong>30 million rides</strong> a year, the system feels everywhere if you live near the commercial core.<br><br>" +

            "Over <strong>2,000 stations</strong> light up the grid. <strong>Larger circles</strong> represent busier stations, " +
            "showing how the system is heavily concentrated in the commercial core.<br><br>" +

            "But as dense and vibrant as this network appears, it hides a deeper story about <strong>who actually has access</strong> to these bikes, and who doesn’t.",
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
        content:
            "However, the system isn’t shared equally.<br><br>" +

            "The red areas on the map show neighborhoods where households are predominantly <strong>car-free</strong>, " +
            "places where people rely most on transit, walking, and biking.<br>" +

            "<div class='legend-bar'></div>" +
            "<div class='legend-labels'><span>High Car Ownership</span><span>High Car-Free %</span></div>" +

            "And yet here’s the <strong>surprising contradiction</strong>: areas with the <strong>highest</strong> car-free rates, sections of the Bronx, Brownsville, East New York, and Jamaica, often have <strong>no Citi Bike stations at all</strong>.<br><br>" +

            "Meanwhile, neighborhoods with lower car-free rates, like Midtown, SoHo, and Williamsburg, are covered almost wall-to-wall.<br><br>" +

            "The <strong>gray subway lines</strong> tell another part of the story: once you leave Manhattan, station coverage drops sharply, " +
            "leaving the subway to do nearly all the mobility work alone.<br><br>" +

            "This layering of car-free households, subway lines, and station coverage reveals a spatial mismatch between <strong>transit need</strong> and <strong>bike-share access</strong>. <br><br>" +

            "<em>Turn on “Show Stations” to see exactly where the network thins out and where demand is likely highest.</em>",
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
        content:
            "Therefore, closing this mobility gap requires expanding Citi Bike into the remaining <strong>“Transit Deserts.”</strong><br><br>" +

            "<span class='legend-item'><span class='legend-dot dot-cyan'></span> Future Expansion</span><br><br>" +

            "We identified five high-need areas, including <strong>Flushing</strong> and <strong>Brownsville</strong>, where more than <strong>140,000 households</strong>, many of them car-free, have limited transit options and <strong>no Citi Bike presence</strong>.<br><br>" +

            "These communities aren’t just empty spaces on a map. They represent tens of thousands of residents whose commutes, errands, and daily routines could be transformed by a reliable, affordable mobility option.<br><br>" +

            "These neighborhoods are the <strong>next frontier</strong> for Citi Bike: places where expansion would not only increase ridership, but meaningfully improve <strong>mobility equity</strong>.<br><br>" +

            "<strong>Takeaway:</strong> Citi Bike’s expansion shouldn’t simply follow commercial density, it should also follow <strong>transit need</strong>.<br><br>" +

            "By layering car-free households, subway access, and station coverage, our visualization makes the equity gaps unmistakable. " +
            "Only by targeting these overlooked neighborhoods can Citi Bike become a true citywide transportation system.<br><br>" +

            "<em>Explore the highlighted blue areas. Each represents a community where new stations would have the biggest real-world impact.</em>",
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