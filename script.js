/* Map Initialization */
let map;
let userLocation;
let routeLayer;
let directionMarker;

/* Initializing the Map */
function initMap(lat, lng) {
    if (!map) {
        map = L.map('map').setView([lat, lng], 15);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        document.getElementById('map').classList.add('map-active');
    } else {
        map.setView([lat, lng], 15);
    }

    L.marker([lat, lng], { title: "Selected Location" })
        .addTo(map)
        .bindPopup("Selected Location")
        .openPopup();

    findATMs(lat, lng);
}

/* Find Nearby ATMs Based on User Location */
function findNearbyATMs() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                userLocation = { lat, lng };
                initMap(lat, lng);
            },
            () => {
                document.getElementById("message").textContent = "Geolocation not allowed.";
            }
        );
    } else {
        document.getElementById("message").textContent = "Geolocation is not supported by this browser.";
    }
}

/* Search by Location or Landmark */
function searchLocation() {
    const query = document.getElementById("search").value;
    if (!query) return;

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}, Philippines&countrycodes=PH`)
        .then(response => response.json())
        .then(data => {
            if (data.length === 0) {
                document.getElementById("message").textContent = "Location not found.";
                return;
            }

            const place = data[0];
            document.getElementById("message").textContent = "";
            initMap(place.lat, place.lon);
            findATMs(place.lat, place.lon); /* Find ATMs near the landmark */
        })
        .catch(() => {
            document.getElementById("message").textContent = "Error finding location.";
        });
}

/* Find ATMs (Includes Bank Name) */
function findATMs(lat, lng) {
    const radius = 1000; /* 1km radius */
    const selectedBank = document.getElementById("bankFilter").value.toLowerCase();

    const overpassQuery = `
        [out:json];
        node["amenity"="atm"](around:${radius},${lat},${lng});
        out;
    `;

    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(overpassQuery)}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (data.elements.length === 0) {
                document.getElementById("message").textContent = "No ATMs found near this location.";
                return;
            }

            /* Remove previous ATM markers */
            map.eachLayer(layer => {
                if (layer instanceof L.Marker && layer.options.title !== "Selected Location") {
                    map.removeLayer(layer);
                }
            });

            let foundATM = false;
            data.elements.forEach(atm => {
                const { lat, lon, tags } = atm;
                const name = tags.name || "ATM";
                const operator = tags.operator || "Unknown Bank"; // Bank name

                /* Apply bank filter */
                if (selectedBank && !operator.toLowerCase().includes(selectedBank)) return;

                foundATM = true;
                L.marker([lat, lon])
                    .addTo(map)
                    .bindPopup(`
                        <strong>${name}</strong><br>
                        🏦 Bank: ${operator}<br>
                        <button onclick="getDirections(${lat}, ${lon}, '${operator}')">Get Directions</button>
                        <button onclick="closeDirections()" id="close-directions" style="display: none;">❌ Close Directions</button>
                        <p id="route-info"></p>
                    `);
            });

            if (!foundATM) {
                document.getElementById("message").textContent = `No ATMs found for ${selectedBank.toUpperCase()} near this location.`;
            }
        })
        .catch(() => {
            document.getElementById("message").textContent = "Error fetching ATM data.";
        });
}

/* Get Directions to ATM */ 
function getDirections(atmLat, atmLon, bankName) {
    if (!userLocation) {
        document.getElementById("message").textContent = "Enable location to get directions.";
        return;
    }

    const { lat, lng } = userLocation;

    /* Remove previous route & marker */
    if (routeLayer) {
        map.removeLayer(routeLayer);
    }
    if (directionMarker) {
        map.removeLayer(directionMarker);
    }

    /* Add ATM marker only when getting directions */
    directionMarker = L.marker([atmLat, atmLon], { title: "Destination" })
        .addTo(map)
        .bindPopup(`<strong>${bankName} ATM</strong><br>🚶 Directions Active`);

    const routingAPI = `https://router.project-osrm.org/route/v1/foot/${lng},${lat};${atmLon},${atmLat}?overview=full&geometries=geojson`;

    fetch(routingAPI)
        .then(response => response.json())
        .then(data => {
            if (data.routes.length > 0) {
                const route = data.routes[0];
                const routeCoords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                const distance = (route.distance / 1000).toFixed(2); /* Convert meters to km */
                const time = Math.round(route.duration / 60); /* Convert seconds to minutes */

                routeLayer = L.polyline(routeCoords, { color: "blue", weight: 5 }).addTo(map);
                map.fitBounds(routeLayer.getBounds());

                document.getElementById("route-info").textContent = `🚶 ${distance} km | ⏳ ${time} mins`;

                /* Show the close button when directions are shown */
                const closeBtn = document.getElementById("close-directions");
                if (closeBtn) {
                    closeBtn.style.display = "inline-block";
                }
            } else {
                document.getElementById("message").textContent = "No route found.";
            }
        })
        .catch(() => {
            document.getElementById("message").textContent = "Error getting directions.";
        });
}

/* Close Directions */
function closeDirections() {
    if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
    }
    if (directionMarker) {
        map.removeLayer(directionMarker);
        directionMarker = null;
    }

    document.getElementById("route-info").textContent = "";
    document.getElementById("close-directions").style.display = "none"; /* Hide close button */
}


