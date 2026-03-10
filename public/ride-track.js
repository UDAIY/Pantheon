// ride-track.js — Simulated real-time ride tracking

(function () {
    'use strict';

    const token = localStorage.getItem('token');
    if (!token) { window.location.href = '/login.html'; return; }

    const params = new URLSearchParams(window.location.search);
    const rideId = params.get('rideId');
    if (!rideId) { window.location.href = '/index.html'; return; }

    let map, routeLayer, driverMarker;
    let routeCoords = []; // Array of [lat, lng]
    let animIndex = 0;
    let animTimer = null;
    let rideData = null;
    let socket = null;

    // DOM refs
    const statusCard = document.getElementById('statusCard');
    const searchingState = document.getElementById('searchingState');
    const driverState = document.getElementById('driverState');

    const statusBadge = document.getElementById('statusBadge');
    const statusTitle = document.getElementById('statusTitle');
    const statusSubtitle = document.getElementById('statusSubtitle');

    const driverRow = document.getElementById('driverRow');
    const driverAvatar = document.getElementById('driverAvatar');
    const driverName = document.getElementById('driverName');
    const driverVehicle = document.getElementById('driverVehicle');
    const driverRating = document.getElementById('driverRating');
    const rideEta = document.getElementById('rideEta');
    const rideDistance = document.getElementById('rideDistance');
    const rideFare = document.getElementById('rideFare');

    const cancelSearchBtn = document.getElementById('cancelSearchBtn');
    const cancelRideBtn = document.getElementById('cancelRideBtn');
    const actionContainerDriver = document.getElementById('actionBtnContainerDriver');

    // Dummy element references
    let dummyDrivers = [];

    // Fetch welcome
    fetch('/api/user/info', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(u => { document.getElementById('trackWelcome').textContent = 'Welcome, ' + u.name; })
        .catch(() => { });

    // Initialize
    initMap();
    loadRide();

    function initMap() {
        map = L.map('trackMap', { zoomControl: false }).setView([26.8467, 80.9462], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 19
        }).addTo(map);
    }

    async function loadRide() {
        try {
            const res = await fetch(`/api/rides/${rideId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) { window.location.href = '/index.html'; return; }

            rideData = await res.json();
            const driver = rideData.driverId;

            // Fill ride info
            rideEta.textContent = rideData.duration + ' min';
            rideDistance.textContent = rideData.distance + ' km';
            rideFare.textContent = '₹' + rideData.fare;

            // Show driver info
            if (driver) {
                driverRow.style.display = 'flex';
                driverAvatar.textContent = driver.name.charAt(0).toUpperCase();
                driverName.textContent = driver.name;
                driverVehicle.textContent = `${driver.vehicle.color} ${driver.vehicle.model} · ${driver.vehicle.plate}`;
                driverRating.textContent = '⭐ ' + driver.rating.toFixed(1);
            }

            // Place pickup marker with pulsing radar
            const pLat = rideData.pickup.lat, pLng = rideData.pickup.lng;
            const dLat = rideData.dropoff.lat, dLng = rideData.dropoff.lng;

            const radarIcon = L.divIcon({
                className: '',
                html: '<div class="radar-marker"></div>',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            L.marker([pLat, pLng], { icon: radarIcon }).addTo(map).bindPopup('📍 Pickup');

            L.circleMarker([dLat, dLng], {
                radius: 8, fillColor: '#333', color: '#fff', weight: 3, fillOpacity: 1
            }).addTo(map).bindPopup('📍 Dropoff');

            // Fetch and draw route
            const routeUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`;
            const routeRes = await fetch(routeUrl);
            const routeData = await routeRes.json();

            if (routeData.routes && routeData.routes.length > 0) {
                routeCoords = routeData.routes[0].geometry.coordinates.map(c => [c[1], c[0]]);

                routeLayer = L.polyline(routeCoords, {
                    color: '#000', weight: 4, opacity: 0.8
                }).addTo(map);

                map.fitBounds(routeLayer.getBounds(), { padding: [80, 80] });
            }

            setTimeout(() => { map.invalidateSize(); }, 200);
            setTimeout(() => { map.invalidateSize(); }, 500);

            // Start simulation sequence
            startSimulation();

        } catch (err) {
            console.error('Error loading ride:', err);
        }
    }

    function startSimulation() {
        const pLat = rideData.pickup.lat;
        const pLng = rideData.pickup.lng;

        // Connect to Socket to listen for real updates
        socket = io({
            auth: { token }
        });

        socket.on('connect', () => {
            console.log('Connected to socket server for tracking');
        });

        // Listen for Driver Accepting the Ride
        socket.on('ride_accepted', (updatedRide) => {
            console.log('Driver accepted ride:', updatedRide);
            rideData = updatedRide; // Update local state with driver details

            // Switch from "Searching" to "Assigned"
            handleDriverAssigned();
        });

        socket.on('driver_location_update', (loc) => {
            if (driverMarker) {
                driverMarker.setLatLng([loc.lat, loc.lng]);
                map.panTo([loc.lat, loc.lng], { animate: true });
            }
        });

        // Phase 1: "Searching for driver" UI
        searchingState.style.display = 'block';
        driverState.style.display = 'none';

        // Add 3 dummy cars jittering around
        const simIcon = L.divIcon({
            className: '',
            html: '<div class="sim-car">🚕</div>',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        for (let i = 0; i < 3; i++) {
            const dlat = pLat + (Math.random() - 0.5) * 0.015;
            const dlng = pLng + (Math.random() - 0.5) * 0.015;
            dummyDrivers.push(L.marker([dlat, dlng], { icon: simIcon }).addTo(map));
        }

        // Phase 2: Driver Assigned - Waits for socket event instead of setTimeout
        // We removed the setTimeout here.
    }

    function handleDriverAssigned() {
        // Remove dummy drivers
        dummyDrivers.forEach(m => map.removeLayer(m));
        dummyDrivers = [];

        // Switch UI State
        searchingState.style.display = 'none';
        driverState.style.display = 'block';
        updateDriverState('assigned', 'Driver Assigned', 'Your driver is on the way', 'They will arrive shortly');

        const pLat = rideData.pickup.lat;
        const pLng = rideData.pickup.lng;

        // Set initial Driver Marker Position (Defaulting to offset for now until live location sync)
        const offsetLat = pLat + 0.008;
        const offsetLng = pLng + 0.008;

        driverMarker = L.marker([offsetLat, offsetLng], {
            icon: L.divIcon({
                className: '',
                html: '<div class="driver-marker">🚙</div>',
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            })
        }).addTo(map);

        map.fitBounds(L.latLngBounds([[pLat, pLng], [offsetLat, offsetLng]]), { padding: [50, 50] });

        // Phase 3: After 2s -> driver arriving at pickup (move marker to pickup)
        setTimeout(() => {
            updateDriverState('enroute', 'Driver Arriving', rideData.driverId.name + ' is almost there', 'Please be ready at the pickup point');
            animateMarkerTo(driverMarker, [pLat, pLng], 3000, () => {

                // Phase 4: Arrived
                setTimeout(() => {
                    updateDriverState('arrived', 'Driver Arrived', rideData.driverId.name + ' has arrived', 'Meet your driver at the pickup point');

                    // Phase 5: After 2s -> trip in progress
                    setTimeout(() => {
                        updateDriverState('inprogress', 'Trip In Progress', 'Enjoy your ride!', 'Heading to: ' + rideData.dropoff.address);

                        // Remove cancel button during ride
                        actionContainerDriver.innerHTML = '';

                        // Auto zoom to full route
                        map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

                        // Animate full route
                        animateAlongRoute();
                    }, 2500);
                }, 1000);
            });
        }, 2000);
    }

    function animateMarkerTo(marker, targetLatLng, duration, callback) {
        const start = marker.getLatLng();
        const startTime = performance.now();
        const dlat = targetLatLng[0] - start.lat;
        const dlng = targetLatLng[1] - start.lng;

        function step(ts) {
            const elapsed = ts - startTime;
            const t = Math.min(elapsed / duration, 1);
            const ease = t * (2 - t); // ease-out
            marker.setLatLng([start.lat + dlat * ease, start.lng + dlng * ease]);
            if (t < 1) {
                requestAnimationFrame(step);
            } else {
                if (callback) callback();
            }
        }
        requestAnimationFrame(step);
    }

    function animateAlongRoute() {
        if (routeCoords.length === 0) { completeRide(); return; }

        // Subsample route for smoother but faster animation
        const stepCount = Math.min(routeCoords.length, 120);
        const step = Math.max(1, Math.floor(routeCoords.length / stepCount));
        const sampled = [];
        for (let i = 0; i < routeCoords.length; i += step) {
            sampled.push(routeCoords[i]);
        }
        sampled.push(routeCoords[routeCoords.length - 1]);

        let idx = 0;
        animTimer = setInterval(() => {
            if (idx >= sampled.length) {
                clearInterval(animTimer);
                completeRide();
                return;
            }
            driverMarker.setLatLng(sampled[idx]);
            // Keep map centered on driver roughly
            if (idx % 5 === 0) {
                map.panTo(sampled[idx], { animate: true, duration: 0.3 });
            }
            // Update ETA countdown
            const remaining = Math.ceil(rideData.duration * (1 - idx / sampled.length));
            rideEta.textContent = remaining + ' min';
            idx++;
        }, 150);
    }

    async function completeRide() {
        updateDriverState('completed', 'Ride Complete', 'You have arrived!', 'Thank you for riding with ViceRide');

        try {
            await fetch(`/api/rides/${rideId}/complete`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
        } catch (e) { console.error(e); }

        rideEta.textContent = '0 min';
        actionContainerDriver.innerHTML = '<button class="action-btn home-btn" id="homeBtn">Back to Home</button>';
        document.getElementById('homeBtn').addEventListener('click', () => { window.location.href = '/index.html'; });
    }

    function updateDriverState(badgeClass, badgeText, title, subtitle) {
        statusBadge.className = 'status-badge ' + badgeClass;
        statusBadge.textContent = badgeText;
        statusTitle.textContent = title;
        statusSubtitle.textContent = subtitle;
    }

    async function handleCancel() {
        if (!confirm('Are you sure you want to cancel this ride?')) return;
        try {
            const res = await fetch(`/api/rides/${rideId}/cancel`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
            if (res.ok) {
                if (animTimer) clearInterval(animTimer);
                window.location.href = '/index.html';
            }
        } catch (e) { console.error(e); }
    }

    // Cancel inputs
    if (cancelSearchBtn) cancelSearchBtn.addEventListener('click', handleCancel);
    if (cancelRideBtn) cancelRideBtn.addEventListener('click', handleCancel);
})();
