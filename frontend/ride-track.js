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
    let driverAssigned = false;

    // Fetch welcome
    fetch('/api/user/info', { headers: { 'Authorization': 'Bearer ' + token } })
        .then(r => r.json())
        .then(u => { document.getElementById('trackWelcome').textContent = 'Welcome, ' + u.name; })
        .catch(() => { });

    // Initialize
    initMap();
    initSocket();
    loadRide();

    function initMap() {
        map = L.map('trackMap', { zoomControl: false }).setView([26.8467, 80.9462], 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap', maxZoom: 19
        }).addTo(map);
    }

    function initSocket() {
        // Initialize socket connection early
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

        // Listen for PIN verification confirmation
        socket.on('ride_confirmed', (confirmedRide) => {
            console.log('Ride confirmed via PIN verification:', confirmedRide);
            rideData = confirmedRide;
            // Update title to show ride is confirmed
            updateDriverState('On the way', 'Driver verified via PIN');
        });

        // Listen for real-time driver location updates
        socket.on('driver_location_update', (loc) => {
            if (driverMarker && driverAssigned) {
                driverMarker.setLatLng([loc.lat, loc.lng]);
                map.panTo([loc.lat, loc.lng], { animate: true });
            }
        });

        socket.on('disconnect', () => {
            console.log('Disconnected from socket server');
        });
    }

    async function loadRide() {
        try {
            const res = await fetch(`/api/rides/${rideId}`, {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            if (!res.ok) { window.location.href = '/index.html'; return; }

            rideData = await res.json();
            
            // Fill ride info
            rideEta.textContent = rideData.duration + ' min';
            rideDistance.textContent = rideData.distance + ' km';
            rideFare.textContent = '₹' + rideData.fare;

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

            // Check if driver is already assigned (in case we reload or refresh page)
            if (rideData.driverId && rideData.status === 'driver-assigned') {
                handleDriverAssigned();
            } else {
                // Start simulation sequence (shows dummy cars)
                startSimulation();
            }

        } catch (err) {
            console.error('Error loading ride:', err);
        }
    }

    function startSimulation() {
        const pLat = rideData.pickup.lat;
        const pLng = rideData.pickup.lng;

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

        // Phase 2: Wait for socket.io ride_accepted event
        // handleDriverAssigned will be called via the socket listener
    }

    function handleDriverAssigned() {
        // Mark driver as assigned so location updates process
        driverAssigned = true;

        // Remove dummy drivers
        dummyDrivers.forEach(m => map.removeLayer(m));
        dummyDrivers = [];

        // Switch UI State
        searchingState.style.display = 'none';
        driverState.style.display = 'block';

        const driver = rideData.driverId;
        if (driver) {
            // Update driver card
            
            // Driver avatar with initials
            const initials = driver.name 
                ? driver.name.split(' ').map(n => n.charAt(0)).join('').toUpperCase() 
                : '?';
            driverAvatar.textContent = initials;
            driverAvatar.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
            
            // Driver name
            driverName.textContent = driver.name || 'Unknown Driver';

            // Vehicle info - plate number prominently displayed
            const vColor = driver.vehicle?.color || 'White';
            const vModel = driver.vehicle?.model || 'Sedan';
            const vPlate = driver.vehicle?.plate || 'VCE-RIDE';
            const vType = driver.vehicle?.type || 'sedan';

            driverVehicle.textContent = `${vColor} ${vModel}`;
            
            // Update license plate display
            const licensePlateEl = document.getElementById('licensePlate');
            if (licensePlateEl) {
                licensePlateEl.textContent = vPlate;
            }
            
            // Rating
            const rating = driver.rating ? driver.rating.toFixed(2) : '5.0';
            driverRating.textContent = `⭐ ${rating}`;

            // Ride info
            rideEta.textContent = rideData.duration + ' min';
            rideDistance.textContent = rideData.distance + ' km';
            rideFare.textContent = '₹' + rideData.fare;

            // Display the actual verification PIN
            const pinDisplay = document.getElementById('pinDisplay');
            if (pinDisplay && rideData.verificationPin) {
                pinDisplay.textContent = rideData.verificationPin;
            }
        }

        const pLat = rideData.pickup.lat;
        const pLng = rideData.pickup.lng;

        // Get driver's initial location
        const driver_obj = rideData.driverId;
        const initialDLat = driver_obj?.location?.lat || (pLat + 0.008);
        const initialDLng = driver_obj?.location?.lng || pLng;

        // Update status with estimated pickup time - using new confirmed style
        updateDriverState('confirmed', 'Alex has accepted!', 'Arriving in ' + rideData.duration + ' minutes');

        // Create driver marker
        driverMarker = L.marker([initialDLat, initialDLng], {
            icon: L.divIcon({
                className: '',
                html: '<div class="driver-marker">🚙</div>',
                iconSize: [38, 38],
                iconAnchor: [19, 19]
            })
        }).addTo(map);

        // Fit map bounds
        map.fitBounds(L.latLngBounds([[pLat, pLng], [initialDLat, initialDLng]]), { padding: [50, 50] });

        // Setup button listeners for new button layout
        const callBtn = document.getElementById('callBtn');
        const messageBtn = document.getElementById('messageBtn');
        const sosBtn = document.getElementById('sosBtn');

        if (callBtn) {
            callBtn.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Calling driver:', driver?.name);
                alert(`Calling ${driver?.name || 'Driver'}...`);
            });
        }

        if (messageBtn) {
            messageBtn.addEventListener('click', (e) => {
                e.preventDefault();
                openMessageModal();
            });
        }

        if (sosBtn) {
            sosBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (confirm('Alert your driver and safety team?')) {
                    console.log('SOS activated');
                    alert('Emergency alert sent to driver and safety team');
                }
            });
        }

        // Real-time socket updates will update the driverMarker position
    }

    function openMessageModal() {
        const modal = document.getElementById('messageModal');
        const input = document.getElementById('messageInput');
        const charCount = document.getElementById('charCount');
        const sendBtn = document.getElementById('sendMsgBtn');
        const cancelBtn = document.getElementById('cancelMsgBtn');

        // Clear previous message
        input.value = '';
        charCount.textContent = '0/200';

        // Show modal
        modal.style.display = 'flex';

        // Character counter
        input.addEventListener('input', (e) => {
            charCount.textContent = e.target.value.length + '/200';
        });

        // Send message
        sendBtn.onclick = () => {
            const message = input.value.trim();
            if (message.length === 0) {
                alert('Please enter a message');
                return;
            }

            // Send message via Socket.IO
            if (socket && rideData && rideData.driverId) {
                socket.emit('passenger_message', {
                    driverId: rideData.driverId._id,
                    rideId: rideId,
                    message: message,
                    timestamp: new Date().toISOString()
                });

                // Show confirmation
                input.value = '';
                charCount.textContent = '0/200';
                modal.style.display = 'none';
                
                // Visual feedback
                alert('Message sent to driver!');
            }
        };

        // Cancel
        cancelBtn.onclick = () => {
            modal.style.display = 'none';
        };

        // Click outside to close
        modal.onclick = (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        };

        input.focus();
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
        updateDriverState('completed', 'Ride Complete', 'You have arrived! Thank you for riding with ViceRide');

        try {
            await fetch(`/api/rides/${rideId}/complete`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + token } });
        } catch (e) { console.error(e); }

        rideEta.textContent = '0 min';
        actionContainerDriver.innerHTML = '<button class="action-btn home-btn" id="homeBtn">Back to Home</button>';
        document.getElementById('homeBtn').addEventListener('click', () => { window.location.href = '/index.html'; });
    }

    function updateDriverState(badgeClass, title, subtitle) {
        // Updated to handle new confirmed state
        if (badgeClass !== 'confirmed') {
            statusTitle.textContent = title;
            statusSubtitle.textContent = subtitle;
        }
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
