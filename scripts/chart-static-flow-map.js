export async function drawStaticFlowMap() {
    d3.csv("data/202301-citibike-50k.csv").then(data => {

        // Aggregate station-level flow
        const stations = d3.rollup(
            data,
            v => ({
                departures: v.length,
                arrivals: 0
            }),
            d => d.start_station_id
        );

        // Add arrivals
        data.forEach(d => {
            const id = d.end_station_id;
            if (stations.has(id)) {
                stations.get(id).arrivals += 1;
            } else {
                stations.set(id, { departures: 0, arrivals: 1 });
            }
        });

        // Build array of stations with coordinates
        let stationData = [];
        data.forEach(d => {
            const id = d.start_station_id;
            if (!stationData.some(s => s.id === id)) {
                stationData.push({
                    id: id,
                    name: d.start_station_name,
                    lat: +d.start_lat,
                    lng: +d.start_lng,
                    departures: stations.get(id)?.departures || 0,
                    arrivals: stations.get(id)?.arrivals || 0
                });
            }
        });

        // Remove missing coordinate points
        stationData = stationData.filter(d => d.lat && d.lng);

        // Compute flow + bias
        stationData.forEach(d => {
            d.totalFlow = d.departures + d.arrivals;
            d.bias = d.departures - d.arrivals; // + = more departures, - = more arrivals
        });

        // Set map dimensions
        const width = 900, height = 700;

        const svg = d3.select("#static-flow-map")
            .append("svg")
            .attr("width", width)
            .attr("height", height);

        // NYC geo projection
        const projection = d3.geoMercator()
            .center([-73.97, 40.75]) // Manhattan center
            .scale(90000)
            .translate([width / 2, height / 2]);

        // Scales
        const radiusScale = d3.scaleSqrt()
            .domain([0, d3.max(stationData, d => d.totalFlow)])
            .range([1, 18]);

        const colorScale = d3.scaleLinear()
            .domain([-200, 0, 200])
            .range(["#ef4444", "#a78bfa", "#3b82f6"]); // arrival → balanced → departure

        // Draw circles
        svg.selectAll("circle")
            .data(stationData)
            .enter()
            .append("circle")
            .attr("class", "flow-circle")
            .attr("cx", d => projection([d.lng, d.lat])[0])
            .attr("cy", d => projection([d.lng, d.lat])[1])
            .attr("r", d => radiusScale(d.totalFlow))
            .attr("fill", d => colorScale(d.bias));
    });

}