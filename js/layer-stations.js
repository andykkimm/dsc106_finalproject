export function addStationLayer(map, data) {
    map.addSource('stations', {
        type: 'geojson',
        data: data
    });

    map.addLayer({
        id: 'stations-points',
        type: 'circle',
        source: 'stations',
        paint: {
            'circle-radius': [
                'interpolate', ['linear'], ['get', 'count'],
                0, 2,      
                50, 4,     
                100, 6,
                300, 10,
                1000, 20   
            ],
            'circle-color': [
                'match', ['get', 'majority_type'],
                'member', '#007bff', 
                'casual', '#dc3545', 
                '#ccc'
            ],
            'circle-opacity': 0.6,       
            'circle-stroke-width': 1,    
            'circle-stroke-color': '#ffffff',
            'circle-stroke-opacity': 0.6 
        }
    });

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    map.on('mouseenter', 'stations-points', (e) => {
        if (map.getPaintProperty('stations-points', 'circle-opacity') === 0) return;
        
        map.getCanvas().style.cursor = 'pointer';
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        
        popup.setLngLat(coordinates)
            .setHTML(`
                <strong>${props.name}</strong><br>
                Trips: ${props.count}<br>
                Type: ${props.majority_type.charAt(0).toUpperCase() + props.majority_type.slice(1).toLowerCase()}
            `)
            .addTo(map);
    });

    map.on('mouseleave', 'stations-points', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });
}