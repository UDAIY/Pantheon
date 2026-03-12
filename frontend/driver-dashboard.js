// driver-dashboard.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/driver-login.html';
        return;
    }

    let user = null;
    let driverMarker = null;
    let watchId = null;
    let socket = null;
    let currentRideRequest = null;

    const onlineToggle = document.getElementById('onlineToggle');
    const statusLabel = document.getElementById('statusLabel');
    const statusDot = document.getElementById('statusDot');

    const requestOverlay = document.getElementById('requestOverlay');
    const reqFare = document.getElementById('reqFare');
    const reqPickupText = document.getElementById('reqPickupText');
    const reqDropoffText = document.getElementById('reqDropoffText');
    const reqDistance = document.getElementById('reqDistance');
    const reqDuration = document.getElementById('reqDuration');
    const acceptBtn = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');

    // Fetch driver identity
    try {
        const res = await fetch('/api/user/info', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        user = await res.json();

        if (user.role !== 'driver') {
            window.location.href = '/login.html';
            return;
        }

        // Optional: Ensure onboarding is complete
        // if (!user.onboardingComplete) window.location.href = '/driver-onboarding.html';

    } catch (err) {
        console.error(err);
        window.location.href = '/driver-login.html';
        return;
    }

    // Initialize Map (Dark Mode)
    const map = L.map('driverMap', { zoomControl: false }).setView([28.6139, 77.2090], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap contributors © CARTO',
        maxZoom: 20
    }).addTo(map);

    // UI Refs for Telemetry
    const gridCoords = document.getElementById('gridCoords');
    const pingValue = document.getElementById('pingValue');
    let pingInterval;

    // Initial Geolocation grab
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(pos => {
            const { latitude, longitude } = pos.coords;
            map.setView([latitude, longitude], 14);

            // Cyberpunk Holographic Marker
            driverMarker = L.marker([latitude, longitude], {
                icon: L.divIcon({ className: '', html: '<div class="holo-marker"></div>', iconSize: [20, 20], iconAnchor: [10, 10] })
            }).addTo(map);

            gridCoords.innerHTML = `${latitude.toFixed(4)} <br/> ${longitude.toFixed(4)}`;
        });
    }

    // Connect Socket function
    function connectSocket() {
        if (!socket) {
            // Initiate Socket Connection
            socket = io({
                auth: { token }
            });

            socket.on('connect', () => {
                console.log('Connected to socket server');
                // Notify server we went online
                notifyLocationUpdate();
            });

            socket.on('new_ride_request', (ride) => {
                console.log('Received ride request:', ride);
                showRideRequest(ride);
            });

            socket.on('ride_cancelled', (data) => {
                console.log('Ride cancelled by passenger:', data);
                hideRideRequest();
                showCancellationNotification(data);
            });

            socket.on('passenger_message', (data) => {
                console.log('Message from passenger:', data);
                showPassengerMessage(data);
            });

            socket.on('ride_cancelled_by_user', () => {
                hideRideRequest();
                alert("The ride request was cancelled.");
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from socket server');
            });
        }
    }

    function disconnectSocket() {
        if (socket) {
            socket.disconnect();
            socket = null;
        }
    }

    function notifyLocationUpdate() {
        if (socket && navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                const { latitude, longitude } = pos.coords;
                socket.emit('update_location', { lat: latitude, lng: longitude });

                if (driverMarker) {
                    driverMarker.setLatLng([latitude, longitude]);
                    map.panTo([latitude, longitude]);
                }
            });
        }
    }

    // Toggle Online/Offline
    onlineToggle.addEventListener('change', async (e) => {
        const isOnline = e.target.checked;

        try {
            // Update backend status
            await fetch('/api/driver/status', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ isOnline })
            });

            if (isOnline) {
                statusLabel.textContent = 'UPLINK ESTABLISHED';
                statusLabel.style.color = 'var(--cyber-green)';
                statusDot.classList.add('online');
                document.getElementById('uplinkText').style.color = 'var(--cyber-green)';

                // Start fake ping telemetry
                pingValue.innerHTML = `${Math.floor(Math.random() * 20 + 20)} ms <span style="color:var(--cyber-green)">●</span>`;
                pingInterval = setInterval(() => {
                    const ping = Math.floor(Math.random() * 30 + 15);
                    pingValue.innerHTML = `${ping} ms <span style="color:var(--cyber-green)">●</span>`;
                }, 2000);

                // Start socket & GPS watch
                connectSocket();
                watchId = navigator.geolocation.watchPosition(pos => {
                    const { latitude, longitude } = pos.coords;
                    if (driverMarker) driverMarker.setLatLng([latitude, longitude]);
                    gridCoords.innerHTML = `${latitude.toFixed(4)} <br/> ${longitude.toFixed(4)}`;

                    if (socket) socket.emit('update_location', { lat: latitude, lng: longitude });
                }, err => console.error(err), { enableHighAccuracy: true });

            } else {
                statusLabel.textContent = 'SYSTEM OFFLINE';
                statusLabel.style.color = '#888';
                statusDot.classList.remove('online');
                document.getElementById('uplinkText').style.color = '#aaa';

                // Stop telemetry
                clearInterval(pingInterval);
                pingValue.innerHTML = `-- ms <span style="color:#ef4444">●</span>`;

                // Stop socket & GPS watch
                disconnectSocket();
                if (watchId !== null) {
                    navigator.geolocation.clearWatch(watchId);
                    watchId = null;
                }
                hideRideRequest();
            }
        } catch (err) {
            console.error('Failed to change status:', err);
            // Revert UI toggle
            e.target.checked = !isOnline;
        }
    });

    // Ride Request Modal
    function showRideRequest(ride) {
        currentRideRequest = ride;
        reqFare.textContent = `₹${ride.fare}`;
        reqPickupText.textContent = ride.pickup.address;
        reqDropoffText.textContent = ride.dropoff.address;
        reqDistance.textContent = `${ride.distance} km`;
        reqDuration.textContent = `${ride.duration} min`;

        requestOverlay.classList.add('active');

        // Auto-dismiss after 15 seconds if ignored
        currentRideRequest.timeout = setTimeout(() => {
            if (requestOverlay.classList.contains('active')) {
                hideRideRequest();
            }
        }, 15000);
    }

    function hideRideRequest() {
        requestOverlay.classList.remove('active');
        if (currentRideRequest && currentRideRequest.timeout) {
            clearTimeout(currentRideRequest.timeout);
        }
        currentRideRequest = null;
    }

    function showCancellationNotification(data) {
        // Create a notification element
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #ef4444;
            color: white;
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 2000;
            max-width: 380px;
            animation: slideIn 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">
                Ride Cancelled
            </div>
            <div style="font-size: 0.95rem; line-height: 1.5;">
                <strong>${data.passengerName}</strong> cancelled the ride.<br>
                <small style="opacity: 0.9;">📍 ${data.pickup?.address || 'From pickup location'}</small>
            </div>
        `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 5000);
    }

    function showPassengerMessage(data) {
        // Create a message notification
        const msgNotification = document.createElement('div');
        msgNotification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #fff;
            color: #000;
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 2000;
            max-width: 380px;
            border-left: 4px solid #007AFF;
            animation: slideIn 0.3s ease;
        `;

        msgNotification.innerHTML = `
            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem; color: #007AFF;">
                📬 Message from Passenger
            </div>
            <div style="font-size: 0.95rem; line-height: 1.5; color: #333; margin-bottom: 0.5rem;">
                "${data.message}"
            </div>
            <div style="font-size: 0.75rem; color: #999;">
                ${new Date(data.timestamp).toLocaleTimeString()}
            </div>
        `;

        document.body.appendChild(msgNotification);

        // Auto-remove after 6 seconds
        setTimeout(() => {
            msgNotification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => msgNotification.remove(), 300);
        }, 6000);
    }

    // Decline Action
    declineBtn.addEventListener('click', () => {
        hideRideRequest(); // Just hide the UI, we don't need to notify backend for a decline broadcast unless specific pooling is used.
    });

    // Accept Action
    acceptBtn.addEventListener('click', async () => {
        if (!currentRideRequest) return;

        const rideId = currentRideRequest._id;
        acceptBtn.disabled = true;
        acceptBtn.textContent = 'INITIALIZING...';

        try {
            // Let the server know we want to accept. First come first serve.
            const res = await fetch(`/api/rides/${rideId}/accept`, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token }
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || 'Failed to accept ride.');
            }

            // Successfully accepted - show PIN verification modal
            hideRideRequest();
            showPinVerificationModal(rideId);

        } catch (err) {
            alert(err.message || 'Trace Lost.');
            hideRideRequest();
        } finally {
            acceptBtn.disabled = false;
            acceptBtn.textContent = 'INITIALIZE';
        }
    });

    function showPassengerMessage(data) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(0, 150, 255, 0.15);
            border: 2px solid #0096ff;
            color: white;
            padding: 1.5rem 2rem;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
            z-index: 2000;
            max-width: 380px;
            animation: slideIn 0.3s ease;
        `;

        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        notification.innerHTML = `
            <div style="font-weight: 700; font-size: 1.1rem; margin-bottom: 0.5rem;">
                📬 Passenger Message
            </div>
            <div style="font-size: 0.95rem; line-height: 1.5; margin-bottom: 0.5rem;">
                ${data.message}
            </div>
            <small style="opacity: 0.7;">${timestamp}</small>
        `;

        document.body.appendChild(notification);

        // Auto-dismiss after 6 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 6000);
    }

    function showPinVerificationModal(rideId) {
        const pinOverlay = document.getElementById('pinVerificationOverlay');
        const pinInput = document.getElementById('pinInput');
        const pinVerifyBtn = document.getElementById('pinVerifyBtn');
        const pinCancelBtn = document.getElementById('pinCancelBtn');
        const pinError = document.getElementById('pinError');

        pinOverlay.classList.add('active');
        pinInput.value = '';
        pinError.style.display = 'none';
        pinInput.focus();

        // Handle PIN verification
        pinVerifyBtn.onclick = async () => {
            const pin = pinInput.value.trim();

            if (!pin || pin.length !== 4) {
                pinError.textContent = 'Please enter a 4-digit PIN';
                pinError.style.display = 'block';
                return;
            }

            pinVerifyBtn.disabled = true;
            pinVerifyBtn.textContent = 'VERIFYING...';

            try {
                const res = await fetch(`/api/rides/${rideId}/verify-pin`, {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + token,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ pin })
                });

                const data = await res.json();

                if (!res.ok) {
                    pinError.textContent = data.message || 'Invalid PIN';
                    pinError.style.display = 'block';
                    return;
                }

                // PIN verified successfully
                pinOverlay.classList.remove('active');
                alert('✓ PIN Verified! Ride confirmed and in progress.');

            } catch (err) {
                pinError.textContent = 'Verification failed. Try again.';
                pinError.style.display = 'block';
            } finally {
                pinVerifyBtn.disabled = false;
                pinVerifyBtn.textContent = 'VERIFY PIN';
            }
        };

        // Handle cancel
        pinCancelBtn.onclick = () => {
            pinOverlay.classList.remove('active');
        };

        // Allow Enter key to submit
        pinInput.onkeypress = (e) => {
            if (e.key === 'Enter') {
                pinVerifyBtn.click();
            }
        };
    }

    // Logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (onlineToggle.checked) onlineToggle.click(); // Turn offline explicitly
        localStorage.removeItem('token');
        window.location.href = '/driver-login.html';
    });
});
