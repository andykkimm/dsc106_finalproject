export async function drawDurationChart() {
    let data = await d3.csv('data/202301-citibike-50k.csv', d3.autoType);
    
    // Calculate trip duration in minutes
    data.forEach(d => {
        const start = new Date(d.started_at);
        const end = new Date(d.ended_at);
        d.duration = (end - start) / (1000 * 60); // minutes
    });

    // Remove outliers (negative or very long trips)
    data = data.filter(d => d.duration > 0 && d.duration < 180);

    let maxDuration = 60;
    let binSize = 5;

    function updateChart() {
        d3.select('#duration-chart').selectAll('*').remove();

        // Filter by max duration
        const filteredData = data.filter(d => d.duration <= maxDuration);

        // Separate by user type
        const memberData = filteredData.filter(d => d.member_casual === 'member');
        const casualData = filteredData.filter(d => d.member_casual === 'casual');

        // Create histogram bins
        const bins = d3.range(0, maxDuration + binSize, binSize);
        
        const histogram = d3.histogram()
            .domain([0, maxDuration])
            .thresholds(bins);

        const memberBins = histogram(memberData.map(d => d.duration));
        const casualBins = histogram(casualData.map(d => d.duration));

        // Dimensions
        const margin = {top: 20, right: 100, bottom: 50, left: 60};
        const width = 900 - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        // Create SVG
        const svg = d3.select('#duration-chart')
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        // Scales
        const xScale = d3.scaleLinear()
            .domain([0, maxDuration])
            .range([0, width]);

        const yScale = d3.scaleLinear()
            .domain([0, d3.max([
                d3.max(memberBins, d => d.length),
                d3.max(casualBins, d => d.length)
            ])])
            .range([height, 0]);

        // Tooltip
        const tooltip = d3.select('body').select('.tooltip-duration').empty() 
            ? d3.select('body').append('div').attr('class', 'tooltip-duration')
            : d3.select('body').select('.tooltip-duration');
        
        tooltip
            .style('position', 'absolute')
            .style('background', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('pointer-events', 'none')
            .style('opacity', 0);

        // Draw member bars
        svg.selectAll('.bar-member')
            .data(memberBins)
            .enter()
            .append('rect')
            .attr('class', 'bar-member')
            .attr('x', d => xScale(d.x0))
            .attr('y', d => yScale(d.length))
            .attr('width', d => Math.max(0, xScale(d.x1) - xScale(d.x0) - 1))
            .attr('height', d => height - yScale(d.length))
            .attr('fill', '#2E86AB')
            .attr('opacity', 0.7)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1);
                tooltip
                    .style('opacity', 1)
                    .html(`
                        <strong>Members</strong><br/>
                        Duration: ${d.x0.toFixed(0)}-${d.x1.toFixed(0)} min<br/>
                        Trips: ${d.length}
                    `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.7);
                tooltip.style('opacity', 0);
            });

        // Draw casual bars (offset slightly)
        const barWidth = xScale(binSize) - xScale(0);
        svg.selectAll('.bar-casual')
            .data(casualBins)
            .enter()
            .append('rect')
            .attr('class', 'bar-casual')
            .attr('x', d => xScale(d.x0) + barWidth / 2)
            .attr('y', d => yScale(d.length))
            .attr('width', Math.max(0, barWidth / 2 - 1))
            .attr('height', d => height - yScale(d.length))
            .attr('fill', '#A23B72')
            .attr('opacity', 0.7)
            .style('cursor', 'pointer')
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1);
                tooltip
                    .style('opacity', 1)
                    .html(`
                        <strong>Casual</strong><br/>
                        Duration: ${d.x0.toFixed(0)}-${d.x1.toFixed(0)} min<br/>
                        Trips: ${d.length}
                    `)
                    .style('left', (event.pageX + 10) + 'px')
                    .style('top', (event.pageY - 28) + 'px');
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.7);
                tooltip.style('opacity', 0);
            });

        // Axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale));

        svg.append('g')
            .call(d3.axisLeft(yScale));

        // Labels
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + 40)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Trip Duration (minutes)');

        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -45)
            .style('text-anchor', 'middle')
            .style('font-size', '12px')
            .text('Number of Trips');

        // Legend
        const legend = svg.append('g')
            .attr('transform', `translate(${width + 10}, 50)`);

        legend.append('rect')
            .attr('width', 20)
            .attr('height', 20)
            .attr('fill', '#2E86AB')
            .attr('opacity', 0.7);

        legend.append('text')
            .attr('x', 25)
            .attr('y', 15)
            .text('Members')
            .style('font-size', '14px');

        legend.append('rect')
            .attr('y', 30)
            .attr('width', 20)
            .attr('height', 20)
            .attr('fill', '#A23B72')
            .attr('opacity', 0.7);

        legend.append('text')
            .attr('x', 25)
            .attr('y', 45)
            .text('Casual')
            .style('font-size', '14px');

        // Add statistics
        const avgMember = d3.mean(memberData, d => d.duration);
        const avgCasual = d3.mean(casualData, d => d.duration);

        legend.append('text')
            .attr('y', 100)
            .style('font-size', '12px')
            .text(`Avg (Member): ${avgMember.toFixed(1)} min`);

        legend.append('text')
            .attr('y', 115)
            .style('font-size', '12px')
            .text(`Avg (Casual): ${avgCasual.toFixed(1)} min`);
    }

    // Controls
    d3.select('#max-duration').on('input', function() {
        maxDuration = +this.value;
        d3.select('#max-value').text(maxDuration);
        updateChart();
    });

    d3.select('#bin-size').on('input', function() {
        binSize = +this.value;
        d3.select('#bin-value').text(binSize);
        updateChart();
    });

    updateChart();
}
