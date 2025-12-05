const GAP_ZONES = [
    "Coney Island & Brighton Beach",
    "East New York & Spring Creek",
    "Soundview & Parkchester",
    "Flushing-Willets Point",
    "Brownsville"
];

export function addGapLayer(map) {
    // 1. THE FILL
    map.addLayer({
        id: 'gap-fill',
        type: 'fill',
        source: 'tracts',
        filter: ['in', 'display_name', ...GAP_ZONES],
        paint: {
            'fill-color': '#00e5ff',
            'fill-opacity': 0
        }
    });

    map.addLayer({
        id: 'gap-highlight',
        type: 'line',
        source: 'tracts',
        filter: ['in', 'display_name', ...GAP_ZONES],
        paint: {
            'line-color': '#00b8d4',
            'line-width': 2,
            'line-opacity': 0
        }
    });

    const popup = new mapboxgl.Popup({
        closeButton: false,
        closeOnClick: false,
        className: 'gap-popup'
    });

    map.on('mousemove', 'gap-fill', (e) => {
        const currentOpacity = map.getPaintProperty('gap-fill', 'fill-opacity');
        if (currentOpacity === 0) {
            popup.remove();
            return;
        }

        map.getCanvas().style.cursor = 'pointer';

        if (!e.features || e.features.length === 0) return;

        const props = e.features[0].properties;
        const name = props.display_name; 
        const pct = props.display_avg_car_free;
        const total = props.display_households;

        const pctDisplay = (pct !== undefined) ? (pct * 100).toFixed(1) + '%' : 'N/A';

        popup.setLngLat(e.lngLat)
            .setHTML(`
                <div style="font-family: sans-serif; font-size: 13px; line-height: 1.5;">
                    <strong style="color: #00e5ff; font-size: 1.1em; text-transform: uppercase;">${name}</strong><br>
                    <div style="margin-top: 4px; border-top: 1px solid #444; padding-top: 4px;">
                        <span style="color: #ccc">Total Households:</span> <strong>${total.toLocaleString()}</strong><br>
                        <span style="color: #ccc">Avg Car-Free:</span> <strong>${pctDisplay}</strong>
                    </div>
                </div>
            `)
            .addTo(map);
    });

    map.on('mouseleave', 'gap-fill', () => {
        map.getCanvas().style.cursor = '';
        popup.remove();
    });
}