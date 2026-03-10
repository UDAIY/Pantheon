// book.js — Ride booking page with floating overlay logic

(function () {
    'use strict';

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Identify State Overlays
    const searchState = document.getElementById('searchState');
    const vehicleState = document.getElementById('vehicleState');
    const loader = document.getElementById('pageLoader');

    // DOM refs
    const pickupEl = document.getElementById('pickupAddress');
    const dropoffEl = document.getElementById('dropoffAddress');
    const distanceEl = document.getElementById('tripDistance');
    const durationEl = document.getElementById('tripDuration');
    const vehicleListEl = document.getElementById('vehicleList');
    const confirmBtn = document.getElementById('confirmBtn');
    const errorMsg = document.getElementById('errorMsg');

    // Panel Inputs
    const panelPickup = document.getElementById('panelPickup');
    const panelDropoff = document.getElementById('panelDropoff');
    const runSearchBtn = document.getElementById('runSearchBtn');
    const backToSearchBtn = document.getElementById('backToSearchBtn');

    // Vehicle definitions
    const vehicles = [
        { type: 'economy', name: 'Economy', icon: '🚗', desc: 'Affordable rides for everyday', rate: 8 },
        { type: 'comfort', name: 'Comfort', icon: '🚙', desc: 'Extra legroom & newer cars', rate: 12 },
        { type: 'premium', name: 'Premium', icon: '🚘', desc: 'Luxury rides with top drivers', rate: 18 }
    ];
    const BASE_FARE = 25;

    let selectedVehicle = null;
    let routeDistance = 0;  // km
    let routeDuration = 0;  // minutes
    let map = null;
    let routeLayer = null;
    let pickupMarker = null;
    let dropoffMarker = null;

    // Persist active coordinates
    let activePickupLat = null;
    let activePickupLng = null;
    let activeDropoffLat = null;
    let activeDropoffLng = null;
    let activePickupString = "";
    let activeDropoffString = "";

    // Autocomplete Coordinates (used before clicking Search)
    let autoPickupCoords = null;
    let autoDropoffCoords = null;

    // Fetch user welcome
    fetch('/api/user/info', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
        .then(r => r.json())
        .then(user => {
            const welcomeTag = document.getElementById('bookWelcome');
            if (welcomeTag) welcomeTag.textContent = 'Welcome, ' + user.name;
        })
        .catch(() => { });

    // Helper: Build Map
    function initMap(centerLat = 28.6139, centerLng = 77.2090, zoom = 13) {
        if (!map) {
            map = L.map('bookMap', { zoomControl: true }).setView([centerLat, centerLng], zoom);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap',
                maxZoom: 19
            }).addTo(map);
        }
    }

    // --- Geocoding Autocomplete ---
    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    function setupAutocomplete(input, isPickup) {
        if (!input) return;
        const wrapper = input.parentElement;

        let listEl = document.createElement('div');
        listEl.className = 'autocomplete-list';
        listEl.style.display = 'none';
        wrapper.appendChild(listEl);

        const search = debounce(async (query) => {
            if (query.length < 2) { listEl.style.display = 'none'; return; }

            listEl.innerHTML = '<div class="autocomplete-item" style="color:#999;">Searching...</div>';
            listEl.style.display = 'block';

            if (input._abortCtrl) input._abortCtrl.abort();
            input._abortCtrl = new AbortController();

            try {
                const res = await fetch(
                    `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=5`,
                    { signal: input._abortCtrl.signal }
                );
                const data = await res.json();
                const results = data.features || [];

                listEl.innerHTML = '';
                if (results.length === 0) {
                    listEl.innerHTML = '<div class="autocomplete-item" style="color:#999;">No results found</div>';
                    return;
                }

                results.forEach(feature => {
                    const props = feature.properties;
                    const coords = feature.geometry.coordinates; // [lng, lat]
                    const displayName = [props.name, props.city, props.state, props.country].filter(Boolean).join(', ');

                    const item = document.createElement('div');
                    item.className = 'autocomplete-item';
                    item.textContent = displayName;
                    item.addEventListener('mousedown', (e) => {
                        e.preventDefault();
                        input.value = displayName;
                        listEl.style.display = 'none';

                        const lat = coords[1];
                        const lng = coords[0];

                        if (isPickup) {
                            autoPickupCoords = [lat, lng];
                            activePickupString = displayName;
                            // Optionally snap map to pickup early
                            if (map && !autoDropoffCoords) map.setView([lat, lng], 14);
                        } else {
                            autoDropoffCoords = [lat, lng];
                            activeDropoffString = displayName;
                        }
                    });
                    listEl.appendChild(item);
                });
                listEl.style.display = 'block';
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('Geocoding error:', err);
                listEl.innerHTML = '<div class="autocomplete-item" style="color:#999;">Error searching</div>';
            }
        }, 250);

        input.addEventListener('input', (e) => search(e.target.value));
        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) listEl.style.display = 'none';
        });
    }

    setupAutocomplete(panelPickup, true);
    setupAutocomplete(panelDropoff, false);


    // --- Core Routing Logic ---
    async function executeRoute() {
        if (!activePickupLat || !activeDropoffLat) return;

        // Visual State Shift
        searchState.style.display = 'none';
        vehicleState.style.display = 'block';
        loader.classList.remove('hidden');

        // Draw Markers
        if (pickupMarker) map.removeLayer(pickupMarker);
        if (dropoffMarker) map.removeLayer(dropoffMarker);

        pickupMarker = L.circleMarker([activePickupLat, activePickupLng], {
            radius: 8, fillColor: '#000', color: '#fff', weight: 3, fillOpacity: 1
        }).addTo(map).bindPopup('Pickup');

        dropoffMarker = L.circleMarker([activeDropoffLat, activeDropoffLng], {
            radius: 8, fillColor: '#333', color: '#fff', weight: 3, fillOpacity: 1
        }).addTo(map).bindPopup('Dropoff');

        // Reset text
        pickupEl.textContent = activePickupString || 'Selected Location';
        dropoffEl.textContent = activeDropoffString || 'Selected Location';

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${activePickupLng},${activePickupLat};${activeDropoffLng},${activeDropoffLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                routeDistance = parseFloat((route.distance / 1000).toFixed(1)); // km
                routeDuration = Math.ceil(route.duration / 60); // minutes

                distanceEl.textContent = routeDistance + ' km';
                durationEl.textContent = routeDuration + ' min';

                if (routeLayer) map.removeLayer(routeLayer);
                const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                routeLayer = L.polyline(coords, {
                    color: '#000', weight: 4, opacity: 0.8
                }).addTo(map);

                map.fitBounds(routeLayer.getBounds(), { padding: [50, 50] });

                renderVehicles();
            }
        } catch (err) {
            console.error('Routing error:', err);
            errorMsg.textContent = 'Could not fetch route. Please go back and try again.';
        } finally {
            loader.classList.add('hidden');
            setTimeout(() => { map.invalidateSize(); }, 200);
            setTimeout(() => { map.invalidateSize(); }, 600);
        }
    }


    // --- Engine Boot Sequence ---
    const params = new URLSearchParams(window.location.search);
    const urlPickupLat = parseFloat(params.get('pickupLat'));
    const urlDropoffLat = parseFloat(params.get('dropoffLat'));

    if (!isNaN(urlPickupLat) && !isNaN(urlDropoffLat)) {
        // SCENARIO 1: Coming from index.html "See Prices"
        activePickupString = params.get('pickup') || '';
        activeDropoffString = params.get('destination') || '';
        activePickupLat = urlPickupLat;
        activePickupLng = parseFloat(params.get('pickupLng'));
        activeDropoffLat = urlDropoffLat;
        activeDropoffLng = parseFloat(params.get('dropoffLng'));

        initMap(activePickupLat, activePickupLng, 13);
        executeRoute();

    } else {
        // SCENARIO 2: Naked Booking Page (Clicking "Details" directly)
        loader.classList.add('hidden'); // Hide loader while user thinks
        searchState.style.display = 'block';
        vehicleState.style.display = 'none';

        // Try geolocation for center
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    initMap(lat, lng, 12);

                    // Auto-fill pickup box
                    autoPickupCoords = [lat, lng];
                    try {
                        const res = await fetch(`https://photon.komoot.io/reverse?lon=${lng}&lat=${lat}`);
                        const data = await res.json();
                        if (data.features && data.features.length > 0) {
                            const props = data.features[0].properties;
                            const displayName = [props.name, props.street, props.city, props.state].filter(Boolean).join(', ');
                            panelPickup.value = displayName;
                            activePickupString = displayName;
                        } else {
                            panelPickup.value = 'Your current location';
                            activePickupString = 'Your current location';
                        }
                    } catch {
                        panelPickup.value = 'Your current location';
                        activePickupString = 'Your current location';
                    }
                },
                () => {
                    initMap(); // fallback New Delhi
                },
                { enableHighAccuracy: true, timeout: 5000 }
            );
        } else {
            initMap();
        }
    }


    // --- Button Bindings ---
    if (runSearchBtn) {
        runSearchBtn.addEventListener('click', () => {
            if (!autoPickupCoords || !autoDropoffCoords) {
                alert("Please select both a valid Pickup and Dropoff location from the dropdown suggestions.");
                return;
            }
            activePickupLat = autoPickupCoords[0];
            activePickupLng = autoPickupCoords[1];
            activeDropoffLat = autoDropoffCoords[0];
            activeDropoffLng = autoDropoffCoords[1];
            executeRoute();
        });
    }

    if (backToSearchBtn) {
        backToSearchBtn.addEventListener('click', () => {
            vehicleState.style.display = 'none';
            searchState.style.display = 'block';
            if (routeLayer) map.removeLayer(routeLayer);
            if (pickupMarker) map.removeLayer(pickupMarker);
            if (dropoffMarker) map.removeLayer(dropoffMarker);
            // Re-center on whatever the pickup was
            if (activePickupLat) map.setView([activePickupLat, activePickupLng], 14);
        });
    }

    // Vehicle Rendering logic
    function renderVehicles() {
        vehicleListEl.innerHTML = '';
        vehicles.forEach(v => {
            const fare = Math.round(BASE_FARE + routeDistance * v.rate);
            const card = document.createElement('div');
            card.className = 'vehicle-card';
            card.dataset.type = v.type;
            card.innerHTML = `
                <div class="vehicle-icon">${v.icon}</div>
                <div class="vehicle-info">
                    <div class="vehicle-name">${v.name}</div>
                    <div class="vehicle-desc">${v.desc}</div>
                </div>
                <div style="text-align: right;">
                    <div class="vehicle-fare">₹${fare}</div>
                    <div class="vehicle-fare-label">₹${v.rate}/km</div>
                </div>
            `;
            card.addEventListener('click', () => selectVehicle(v.type, card));
            vehicleListEl.appendChild(card);
        });
    }

    function selectVehicle(type, card) {
        selectedVehicle = type;
        document.querySelectorAll('.vehicle-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Confirm ' + vehicles.find(v => v.type === type).name + ' Ride';
    }

    // Confirm ride
    confirmBtn.addEventListener('click', async () => {
        if (!selectedVehicle) return;

        confirmBtn.disabled = true;
        confirmBtn.classList.add('loading');
        errorMsg.textContent = '';

        try {
            const createRes = await fetch('/api/rides', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    pickup: { address: activePickupString, lat: activePickupLat, lng: activePickupLng },
                    dropoff: { address: activeDropoffString, lat: activeDropoffLat, lng: activeDropoffLng },
                    vehicleType: selectedVehicle,
                    distance: routeDistance,
                    duration: routeDuration
                })
            });

            const ride = await createRes.json();
            if (!createRes.ok) throw new Error(ride.message || 'Failed to create ride');

            const confirmRes = await fetch(`/api/rides/${ride._id}/confirm`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            const confirmedRide = await confirmRes.json();
            if (!confirmRes.ok) throw new Error(confirmedRide.message || 'Failed to confirm ride');

            // The confirm API returns { message, ride }. And 'ride' already holds the _id from the create step.
            window.location.href = `/ride-track.html?rideId=${ride._id}`;

        } catch (err) {
            errorMsg.textContent = err.message || 'Something went wrong. Please try again.';
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('loading');
        }
    });
})();
