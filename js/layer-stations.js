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

            'circle-color': '#007bff',
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
            'circle-opacity': 0.8,
            'circle-stroke-opacity': 0.8
        }
    });

    const popup = new mapboxgl.Popup({ closeButton: false, closeOnClick: false });

    map.on('mouseenter', 'stations-points', (e) => {
        if (map.getPaintProperty('stations-points', 'circle-opacity') === 0) return;

        map.getCanvas().style.cursor = 'pointer';
        const coordinates = e.features[0].geometry.coordinates.slice();
        const props = e.features[0].properties;
        const memberPct = Math.round((props.member / props.count) * 100);

        popup.setLngLat(coordinates)
            .setHTML(`
                <div style="font-family: sans-serif; font-size: 12px;">
                    <strong>${props.name}</strong><br>
                    Trips: <strong>${props.count}</strong><br>
                    <span style="color: #ccc">Member Usage:</span> <strong>${memberPct}%</strong>
                </div>
            `)
            .addTo(map);
    });

    map.on('mouseleave', 'stations-points', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });
}