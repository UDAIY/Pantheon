// rental-book.js — Rental booking confirmation logic

(function () {
    'use strict';

    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Read URL params
    const params = new URLSearchParams(window.location.search);
    const pickupAddr = params.get('pickup') || '';
    const pickupLat = parseFloat(params.get('pickupLat'));
    const pickupLng = parseFloat(params.get('pickupLng'));
    const packageType = params.get('package') || '';
    const vehicleType = params.get('vehicle') || '';

    if (!pickupAddr || !packageType || !vehicleType) {
        window.location.href = '/index.html';
        return;
    }

    // Package display names
    const PACKAGES = {
        '1hr-10km': '1 Hour / 10 km',
        '2hr-20km': '2 Hours / 20 km',
        '4hr-40km': '4 Hours / 40 km'
    };

    const PACKAGE_HOURS = {
        '1hr-10km': 1,
        '2hr-20km': 2,
        '4hr-40km': 4
    };

    // Vehicle display names and rates
    const VEHICLES = {
        economy: { name: 'Economy 🚗', rate: 150 },
        comfort: { name: 'Comfort 🚙', rate: 250 },
        premium: { name: 'Premium 🚘', rate: 400 }
    };

    // Fill details
    document.getElementById('pickupAddress').textContent = pickupAddr;
    document.getElementById('packageDisplay').textContent = PACKAGES[packageType] || packageType;
    document.getElementById('vehicleDisplay').textContent = VEHICLES[vehicleType]?.name || vehicleType;

    const hours = PACKAGE_HOURS[packageType] || 1;
    const rate = VEHICLES[vehicleType]?.rate || 150;
    const fare = rate * hours;
    document.getElementById('fareDisplay').textContent = '₹' + fare;

    // Fetch user welcome
    fetch('/api/user/info', {
        headers: { 'Authorization': 'Bearer ' + token }
    })
        .then(r => r.json())
        .then(user => {
            document.getElementById('bookWelcome').textContent = 'Welcome, ' + user.name;
        })
        .catch(() => { });

    // Initialize map
    const map = L.map('rentalMap', { zoomControl: true }).setView(
        [isNaN(pickupLat) ? 26.85 : pickupLat, isNaN(pickupLng) ? 80.95 : pickupLng], 15
    );
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 19
    }).addTo(map);

    if (!isNaN(pickupLat) && !isNaN(pickupLng)) {
        L.circleMarker([pickupLat, pickupLng], {
            radius: 10, fillColor: '#000', color: '#fff', weight: 3, fillOpacity: 1
        }).addTo(map).bindPopup('Pickup: ' + pickupAddr).openPopup();
    }

    setTimeout(() => { map.invalidateSize(); }, 300);

    // Confirm
    const confirmBtn = document.getElementById('confirmBtn');
    const errorMsg = document.getElementById('errorMsg');

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.classList.add('loading');
        errorMsg.textContent = '';

        try {
            // 1. Create rental
            const createRes = await fetch('/api/rentals', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    pickup: {
                        address: pickupAddr,
                        lat: isNaN(pickupLat) ? 0 : pickupLat,
                        lng: isNaN(pickupLng) ? 0 : pickupLng
                    },
                    packageType,
                    vehicleType
                })
            });

            const rental = await createRes.json();
            if (!createRes.ok) throw new Error(rental.message || 'Failed to create rental');

            // 2. Confirm & assign driver
            const confirmRes = await fetch(`/api/rentals/${rental._id}/confirm`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            const confirmed = await confirmRes.json();
            if (!confirmRes.ok) throw new Error(confirmed.message || 'Failed to confirm rental');

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
})();
