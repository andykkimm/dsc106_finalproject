export async function drawHourly() {
    d3.csv("data/202301-citibike-50k.csv").then(data => {

        // Extract hour of day from start + end timestamps
        data.forEach(d => {
            d.start_hour = new Date(d.started_at).getHours();
            d.end_hour = new Date(d.ended_at).getHours();
        });

        // Departures per hour
        const departures = d3.rollup(
            data,
            v => v.length,
            d => d.start_hour
        );

        // Arrivals per hour
        const arrivals = d3.rollup(
            data,
            v => v.length,
            d => d.end_hour
        );

        const hours = d3.range(0, 24);

        const formatted = hours.map(h => ({
            hour: h,
            departures: departures.get(h) || 0,
            arrivals: arrivals.get(h) || 0
        }));

        // SVG setup
        const margin = { top: 60, right: 20, bottom: 60, left: 70 };
        const width = 900 - margin.left - margin.right;
        const height = 450 - margin.top - margin.bottom;

        const svg = d3.select("#hourly-chart")
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // Scales
        const x0 = d3.scaleBand()
            .domain(hours)
            .range([0, width])
            .padding(0.2);

        const x1 = d3.scaleBand()
            .domain(["departures", "arrivals"])
            .range([0, x0.bandwidth()])
            .padding(0.05);

        const y = d3.scaleLinear()
            .domain([0, d3.max(formatted, d => Math.max(d.departures, d.arrivals))])
            .nice()
            .range([height, 0]);

        const color = d3.scaleOrdinal()
            .domain(["departures", "arrivals"])
            .range(["#3b82f6", "#ef4444"]); // blue + red

        // Draw grouped bars
        svg.selectAll(".hour-group")
            .data(formatted)
            .enter()
            .append("g")
            .attr("class", "hour-group")
            .attr("transform", d => `translate(${x0(d.hour)}, 0)`)
            .selectAll("rect")
            .data(d => [
                { key: "departures", value: d.departures },
                { key: "arrivals", value: d.arrivals }
            ])
            .enter()
            .append("rect")
            .attr("x", d => x1(d.key))
            .attr("y", d => y(d.value))
            .attr("width", x1.bandwidth())
            .attr("height", d => height - y(d.value))
            .attr("fill", d => color(d.key));

        // Axes
        svg.append("g")
            .attr("transform", `translate(0, ${height})`)
            .call(d3.axisBottom(x0).tickFormat(d => `${d}:00`))
            .selectAll("text")
            .attr("transform", "rotate(-40)")
            .style("text-anchor", "end");

        svg.append("g").call(d3.axisLeft(y));

        // Labels
        svg.append("text")
            .attr("x", width / 2)
            .attr("y", height + 50)
            .attr("text-anchor", "middle")
            .text("Hour of Day");

        svg.append("text")
            .attr("transform", "rotate(-90)")
            .attr("x", -height / 2)
            .attr("y", -50)
            .attr("text-anchor", "middle")
            .text("Number of Rides");

        // Legend
        const legend = svg.append("g")
            .attr("transform", "translate(-50, -50)");

        ["departures", "arrivals"].forEach((key, i) => {
            legend.append("rect")
                .attr("x", i * 140)
                .attr("width", 20)
                .attr("height", 20)
                .attr("fill", color(key));

            legend.append("text")
                .attr("x", i * 140 + 28)
                .attr("y", 15)
                .text(key.charAt(0).toUpperCase() + key.slice(1));
        });

    });
}