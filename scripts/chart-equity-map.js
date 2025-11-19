export async function drawEquityMap() {
    const container = document.getElementById("equity-map");
    if (!container) return;

    // 1. Define "Logical" Dimensions
    // We ignore container.clientWidth here. We calculate the map based on a 
    // crisp 800x600 grid, then let CSS shrink it to fit the screen.
    const logicalWidth = 800;
    const logicalHeight = 600;

    const tooltip = d3.select("#tooltip");

    // 2. Setup SVG (Responsive)
    const svg = d3.select("#equity-map")
        .html("")
        .append("svg")
        // "viewBox" defines the internal coordinate system
        .attr("viewBox", [0, 0, logicalWidth, logicalHeight])
        // "width/height" tell the browser how to display it
        .attr("width", "100%")
        .attr("height", "auto")
        .style("display", "block") // Removes extra whitespace below SVG
        .style("background-color", "#f1f1f1")
        .style("border-radius", "4px");

    const mapLayer = svg.append("g");

    // 3. Load Data
    const [geoData, censusData, tripData] = await Promise.all([
        d3.json("./data/nyc_tracts.geojson"),
        d3.csv("./data/nyc_transit_equity.csv"),
        d3.csv("./data/202301-citibike-50k.csv")
    ]);

    if (!geoData || !geoData.features) {
        svg.append("text").text("Error: nyc_tracts.geojson is empty").attr("y", 50).attr("x", 50);
        return;
    }

    // 4. Process Data
    const fipsToBorough = {
        "5": "Bronx", "005": "Bronx", "47": "Brooklyn", "047": "Brooklyn",
        "61": "Manhattan", "061": "Manhattan", "81": "Queens", "081": "Queens",
        "85": "Staten Island", "085": "Staten Island"
    };

    const equityMap = new Map();
    censusData.forEach(d => {
        const boroName = fipsToBorough[d.county_fips] || "NYC";
        equityMap.set(d.GEOID, { pct: +d.pct_no_vehicle, borough: boroName });
    });

    const stations = new Map();
    tripData.forEach(d => {
        const processStation = (id, name, latStr, lngStr) => {
            const lat = +latStr; const lng = +lngStr;
            if (lat && lng && !isNaN(lat) && !isNaN(lng) && lat !== 0) {
                if (!stations.has(id)) stations.set(id, { name, lat, lng, trips: 0 });
                stations.get(id).trips += 1;
            }
        };
        processStation(d.start_station_id, d.start_station_name, d.start_lat, d.start_lng);
        processStation(d.end_station_id, d.end_station_name, d.end_lat, d.end_lng);
    });
    const stationArray = Array.from(stations.values());

    // 5. Projection (Fit to Logical Dimensions)
    const projection = d3.geoMercator()
        .fitSize([logicalWidth, logicalHeight], geoData);

    const path = d3.geoPath().projection(projection);

    // 6. Draw Census Tracts
    const colorScale = d3.scaleSequential(d3.interpolateYlOrRd).domain([0, 1]);

    const mouseOverTract = function (event, d) {
        const id = d.properties.geoid || d.properties.GEOID || d.properties.ct2020;
        const data = equityMap.get(String(id));
        const boro = data ? data.borough : "Unknown";
        const val = data ? (data.pct * 100).toFixed(1) + "%" : "N/A";
        const tractName = d.properties.NAMELSAD || `Tract ${id}`;

        tooltip.style("opacity", 1)
            .html(`<strong>${boro}</strong><br>${tractName}<br>No Car: ${val}`);
        d3.select(this).attr("stroke", "#333");
    };

    const mouseMove = (event) => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 15) + "px");
    };

    const tracts = mapLayer.append("g").selectAll("path")
        .data(geoData.features)
        .join("path")
        .attr("d", path)
        .attr("fill", d => {
            const id = d.properties.geoid || d.properties.GEOID || d.properties.ct2020;
            const data = equityMap.get(String(id));
            return (data && !isNaN(data.pct)) ? colorScale(data.pct) : "#f0f0f0";
        })
        .attr("stroke", "#ccc")
        .attr("stroke-width", 0.3)
        .on("mouseover", mouseOverTract)
        .on("mousemove", mouseMove)
        .on("mouseleave", function () {
            tooltip.style("opacity", 0);
            d3.select(this).attr("stroke", "#ccc");
        });

    // 7. Draw Stations
    const sizeScale = d3.scaleSqrt()
        .domain([0, d3.max(stationArray, d => d.trips) || 100])
        .range([2, 10]);

    const bubbles = mapLayer.append("g").selectAll("circle")
        .data(stationArray)
        .join("circle")
        .attr("cx", d => projection([d.lng, d.lat])[0])
        .attr("cy", d => projection([d.lng, d.lat])[1])
        .attr("r", d => sizeScale(d.trips))
        .attr("fill", "#007bff")
        .attr("fill-opacity", 0.6)
        .attr("stroke", "white")
        .attr("stroke-width", 0.5)
        .style("pointer-events", "all")
        .on("mouseover", (event, d) => {
            tooltip.style("opacity", 1).html(`<strong>${d.name}</strong><br>Trips: ${d.trips}`);
        })
        .on("mousemove", mouseMove)
        .on("mouseleave", () => tooltip.style("opacity", 0));

    // 8. Zoom Behavior
    const zoom = d3.zoom()
        .scaleExtent([1, 10])
        .on("zoom", (event) => {
            const { transform } = event;
            mapLayer.attr("transform", transform);

            const strokeW = 0.3 / transform.k;
            tracts.attr("stroke-width", strokeW);
            bubbles.attr("r", d => sizeScale(d.trips) / transform.k)
                .attr("stroke-width", 0.5 / transform.k);
        });

    svg.call(zoom);

    // 9. Controls
    d3.select("#toggle-stations").on("change", function () {
        const isChecked = this.checked;
        bubbles.transition().duration(300)
            .attr("opacity", isChecked ? 1 : 0)
            .style("pointer-events", isChecked ? "all" : "none");
    });

    d3.select("#recenter-btn").on("click", () => {
        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity);
    });

    // 10. Legend
    const legend = svg.append("g").attr("transform", "translate(30, 40)").style("pointer-events", "none");
    legend.append("rect").attr("x", -10).attr("y", -15).attr("width", 160).attr("height", 60)
        .attr("fill", "white").attr("opacity", 0.9).attr("rx", 5).attr("stroke", "#ddd").attr("stroke-width", 0.5)
    legend.append("text").attr("font-weight", "bold").attr("font-size", "12px").text("Car-Free Households (%)");

    const gradientId = "warmGradient";
    const defs = svg.append("defs");
    const linearGradient = defs.append("linearGradient").attr("id", gradientId);
    linearGradient.append("stop").attr("offset", "0%").attr("stop-color", d3.interpolateYlOrRd(0));
    linearGradient.append("stop").attr("offset", "100%").attr("stop-color", d3.interpolateYlOrRd(1));

    legend.append("rect").attr("y", 10).attr("width", 140).attr("height", 10).style("fill", `url(#${gradientId})`);
    legend.append("text").attr("y", 32).attr("x", 0).attr("font-size", "10px").text("0%");
    legend.append("text").attr("y", 32).attr("x", 140).attr("font-size", "10px").attr("text-anchor", "end").text("100%");
}