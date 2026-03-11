// parcel-book.js — Parcel delivery confirmation logic

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

    // DOM refs for Confirmation
    const pickupEl = document.getElementById('pickupAddress');
    const dropoffEl = document.getElementById('dropoffAddress');
    const distanceEl = document.getElementById('tripDistance');
    const durationEl = document.getElementById('tripDuration');
    const fareEl = document.getElementById('fareDisplay');
    const confirmBtn = document.getElementById('confirmBtn');
    const errorMsg = document.getElementById('errorMsg');

    // Panel Inputs
    const panelPickup = document.getElementById('panelPickup');
    const panelDropoff = document.getElementById('panelDropoff');
    const runSearchBtn = document.getElementById('runSearchBtn');
    const backToSearchBtn = document.getElementById('backToSearchBtn');
    const segmentBtns = document.querySelectorAll('.segment-btn');

    // Size definitions for Parcel (Hardcoded default size for Courier for now)
    const packageSize = 'small';
    const SIZES = {
        small: { label: 'Small — Bike 🏍️', icon: '🏍️', rate: 5, base: 20 },
        medium: { label: 'Medium — Car 🚗', icon: '🚗', rate: 8, base: 25 },
        large: { label: 'Large — SUV 🚙', icon: '🚙', rate: 12, base: 35 }
    };
    const sizeInfo = SIZES[packageSize];

    let routeDistance = 0;
    let routeDuration = 0;
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

    // Handle Segment Buttons Toggle
    segmentBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            segmentBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Helper: Build Map
    function initMap(centerLat = 28.6139, centerLng = 77.2090, zoom = 13) {
        if (!map) {
            map = L.map('parcelMap', { zoomControl: true }).setView([centerLat, centerLng], zoom);
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

        const runAutocomplete = debounce(async (query) => {
            if (query.length < 2) { listEl.style.display = 'none'; checkFormValid(); return; }

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
                            if (map && !autoDropoffCoords) map.setView([lat, lng], 14);
                        } else {
                            autoDropoffCoords = [lat, lng];
                            activeDropoffString = displayName;
                        }
                        checkFormValid();
                    });
                    listEl.appendChild(item);
                });
                listEl.style.display = 'block';
            } catch (err) {
                if (err.name === 'AbortError') return;
                console.error('Geocoding error:', err);
                listEl.innerHTML = '<div class="autocomplete-item" style="color:#999;">Error searching</div>';
            }
        }, 300);

        input.addEventListener('input', (e) => {
            if (isPickup) autoPickupCoords = null; else autoDropoffCoords = null;
            checkFormValid();
            runAutocomplete(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) listEl.style.display = 'none';
        });
    }

    setupAutocomplete(panelPickup, true);
    setupAutocomplete(panelDropoff, false);

    function checkFormValid() {
        if (autoPickupCoords && autoDropoffCoords) {
            runSearchBtn.disabled = false;
            runSearchBtn.classList.add('active');
        } else {
            runSearchBtn.disabled = true;
            runSearchBtn.classList.remove('active');
        }
    }


    // --- Core Routing Logic ---
    async function executeRoute() {
        if (!activePickupLat || !activeDropoffLat) return;

        // Visual State Shift
        searchState.style.display = 'none';
        vehicleState.style.display = 'block';
        if (loader) loader.classList.remove('hidden');

        // Draw Markers
        if (pickupMarker) map.removeLayer(pickupMarker);
        if (dropoffMarker) map.removeLayer(dropoffMarker);

        pickupMarker = L.circleMarker([activePickupLat, activePickupLng], {
            radius: 8, fillColor: '#000', color: '#fff', weight: 3, fillOpacity: 1
        }).addTo(map).bindPopup('Sender Pickup');

        dropoffMarker = L.circleMarker([activeDropoffLat, activeDropoffLng], {
            radius: 8, fillColor: '#333', color: '#fff', weight: 3, fillOpacity: 1
        }).addTo(map).bindPopup('Receiver Dropoff');

        // Reset text
        pickupEl.textContent = activePickupString || 'Selected Location';
        dropoffEl.textContent = activeDropoffString || 'Selected Location';

        // Static info population for Parcel UI
        document.getElementById('receiverName').textContent = "Pending (Courier)";
        document.getElementById('receiverPhone').textContent = "N/A";
        document.getElementById('instructionsDisplay').textContent = "None provided";
        document.getElementById('sizeDisplay').textContent = sizeInfo.label;
        document.getElementById('sizeIcon').textContent = sizeInfo.icon;

        try {
            const url = `https://router.project-osrm.org/route/v1/driving/${activePickupLng},${activePickupLat};${activeDropoffLng},${activeDropoffLat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();

            if (data.routes && data.routes.length > 0) {
                const route = data.routes[0];
                routeDistance = parseFloat((route.distance / 1000).toFixed(1));
                routeDuration = Math.ceil(route.duration / 60);

                distanceEl.textContent = routeDistance + ' km';
                durationEl.textContent = routeDuration + ' min';

                // Calculate fare
                const fare = Math.round(sizeInfo.base + (routeDistance * sizeInfo.rate));
                fareEl.textContent = '₹' + fare;

                // Draw route
                if (routeLayer) map.removeLayer(routeLayer);
                const coords = route.geometry.coordinates.map(c => [c[1], c[0]]);
                routeLayer = L.polyline(coords, {
                    color: '#000', weight: 4, opacity: 0.8
                }).addTo(map);

                map.fitBounds(L.latLngBounds([[activePickupLat, activePickupLng], [activeDropoffLat, activeDropoffLng]]), { padding: [50, 50] });
            }
        } catch (err) {
            console.error('Routing error:', err);
            errorMsg.textContent = 'Could not fetch route. Please try again.';
        } finally {
            if (loader) loader.classList.add('hidden');
            setTimeout(() => { map.invalidateSize(); }, 300);
        }
    }


    // --- Event Listeners ---

    // Run Search
    runSearchBtn.addEventListener('click', () => {
        if (!autoPickupCoords || !autoDropoffCoords) return;
        activePickupLat = autoPickupCoords[0];
        activePickupLng = autoPickupCoords[1];
        activeDropoffLat = autoDropoffCoords[0];
        activeDropoffLng = autoDropoffCoords[1];
        executeRoute();
    });

    // Back to Search
    backToSearchBtn.addEventListener('click', () => {
        vehicleState.style.display = 'none';
        searchState.style.display = 'block';
        errorMsg.textContent = '';
        if (routeLayer) map.removeLayer(routeLayer);
        if (pickupMarker) map.removeLayer(pickupMarker);
        if (dropoffMarker) map.removeLayer(dropoffMarker);
        map.setView([activePickupLat || 28.6139, activePickupLng || 77.2090], 13);
    });

    // Confirm delivery
    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('loading');
        errorMsg.textContent = '';

        try {
            // 1. Create parcel
            const createRes = await fetch('/api/parcels', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    pickup: { address: activePickupString, lat: activePickupLat, lng: activePickupLng },
                    dropoff: { address: activeDropoffString, lat: activeDropoffLat, lng: activeDropoffLng },
                    receiverName: "Courier Request",
                    receiverPhone: "N/A",
                    instructions: "",
                    packageSize: packageSize,
                    distance: routeDistance,
                    duration: routeDuration
                })
            });

            const parcel = await createRes.json();
            if (!createRes.ok) throw new Error(parcel.message || 'Failed to create parcel');

            // 2. Confirm & assign driver
            const confirmRes = await fetch(`/api/parcels/${parcel._id}/confirm`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            const confirmed = await confirmRes.json();
            if (!confirmRes.ok) throw new Error(confirmed.message || 'Failed to confirm parcel');

            // 3. Show success and redirect
            document.getElementById('successOverlay').classList.add('show');
            setTimeout(() => {
                window.location.href = '/dashboard.html';
            }, 2500);

        } catch (err) {
            errorMsg.textContent = err.message || 'Something went wrong.';
            confirmBtn.disabled = false;
            confirmBtn.classList.remove('loading');
        }
    });

    // --- On Load Logic ---
    const params = new URLSearchParams(window.location.search);
    const urlPickupLat = parseFloat(params.get('pickupLat'));
    const urlPickupLng = parseFloat(params.get('pickupLng'));
    const urlDropoffLat = parseFloat(params.get('dropoffLat'));
    const urlDropoffLng = parseFloat(params.get('dropoffLng'));

    if (!isNaN(urlPickupLat) && !isNaN(urlPickupLng) && !isNaN(urlDropoffLat) && !isNaN(urlDropoffLng)) {
        // Direct to route
        activePickupLat = urlPickupLat;
        activePickupLng = urlPickupLng;
        activeDropoffLat = urlDropoffLat;
        activeDropoffLng = urlDropoffLng;
        activePickupString = params.get('pickup') || 'Pickup';
        activeDropoffString = params.get('dropoff') || 'Dropoff';

        initMap(activePickupLat, activePickupLng, 13);
        executeRoute();
    } else {
        // Show Search State
        searchState.style.display = 'block';
        vehicleState.style.display = 'none';
        if (loader) loader.classList.add('hidden');

        // Geolocation
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => initMap(pos.coords.latitude, pos.coords.longitude, 14),
                () => initMap()
            );
        } else {
            initMap();
        }
        setTimeout(() => { if (map) map.invalidateSize(); }, 300);
    }
})();
