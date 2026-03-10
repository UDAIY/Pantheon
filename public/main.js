// Passenger role is hardcoded 
let selectedRole = 'user';

// Handle Login
const loginForm = document.getElementById('loginForm');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const messageEl = document.getElementById('loginMessage');

        try {
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.ok) {
                localStorage.setItem('token', data.token);
                window.location.href = '/index.html';
            } else {
                messageEl.textContent = data.message || 'Login failed';
                messageEl.className = 'message error';
            }
        } catch (err) {
            messageEl.textContent = 'Network error. Try again.';
            messageEl.className = 'message error';
        }
    });
}

// Handle Registration
const registerForm = document.getElementById('registerForm');
const otpForm = document.getElementById('otpForm');
let registeredEmail = ''; // To store the email for OTP verification

if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('regName').value;
        const email = document.getElementById('regEmail').value;
        const password = document.getElementById('regPassword').value;
        const phone = document.getElementById('regPhone').value;
        const messageEl = document.getElementById('registerMessage');

        // Prepare registration data
        const registrationData = {
            name,
            email,
            password,
            role: selectedRole,
            phone: phone || undefined
        };



        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(registrationData)
            });

            const data = await res.json();

            if (res.ok) {
                // Success - show OTP form
                registeredEmail = email; // Save for verification step
                registerForm.style.display = 'none';
                document.getElementById('switchFormText').style.display = 'none';
                otpForm.style.display = 'block';
                document.getElementById('otpMessage').textContent = data.message;
                document.getElementById('otpMessage').className = 'message success';
            } else {
                messageEl.textContent = data.message || 'Registration failed';
                messageEl.className = 'message error';
            }
        } catch (err) {
            messageEl.textContent = 'Network error. Try again.';
            messageEl.className = 'message error';
        }
    });
}

// Handle OTP Verification
if (otpForm) {
    otpForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const otp = document.getElementById('otpInput').value;
        const messageEl = document.getElementById('otpMessage');

        try {
            const res = await fetch('/api/auth/verify-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: registeredEmail, otp })
            });

            const data = await res.json();

            if (res.ok) {
                messageEl.textContent = data.message || 'Verification successful! Redirecting to login...';
                messageEl.className = 'message success';
                setTimeout(() => {
                    window.location.href = '/login.html';
                }, 2000);
            } else {
                messageEl.textContent = data.message || 'Verification failed';
                messageEl.className = 'message error';
            }
        } catch (err) {
            messageEl.textContent = 'Network error. Try again.';
            messageEl.className = 'message error';
        }
    });
}

// Handle fetching dashboard data
async function fetchDashboardData() {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const res = await fetch('/api/user/info', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (res.ok) {
            const user = await res.json();

            // On successful login, fetch the user's data from MongoDB and display a dynamic welcome header 
            // (e.g., 'Welcome, Jha Aman Kumar! Role: Admin').
            document.getElementById('welcomeHeader').textContent = `Hi ${user.name}`;

            document.getElementById('infoName').textContent = user.name;
            document.getElementById('infoEmail').textContent = user.email;
        } else {
            // Token invalid or expired
            localStorage.removeItem('token');
            window.location.href = '/login.html';
        }
    } catch (err) {
        console.error('Error fetching dashboard data:', err);
    }
}

// Handle Logout
const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    });
}

// Fetch and render ride history on dashboard
async function fetchRideHistory() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const listEl = document.getElementById('rideHistoryList');
    if (!listEl) return;

    try {
        const res = await fetch('/api/rides', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">Could not load rides.</p>';
            return;
        }

        const rides = await res.json();

        if (rides.length === 0) {
            listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">No rides yet. Book your first ride!</p>';
            return;
        }

        const vehicleIcons = { economy: '🚗', comfort: '🚙', premium: '🚘' };
        const statusColors = {
            'pending': '#f59e0b',
            'confirmed': '#3b82f6',
            'driver-assigned': '#3b82f6',
            'in-progress': '#000',
            'completed': '#10b981',
            'cancelled': '#ef4444'
        };

        listEl.innerHTML = rides.map(ride => {
            const icon = vehicleIcons[ride.vehicleType] || '🚗';
            const date = new Date(ride.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const statusColor = statusColors[ride.status] || '#888';
            const statusLabel = ride.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

            return `
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--border-color,#333);">
                    <div style="font-size:1.8rem;min-width:40px;text-align:center;">${icon}</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary,#fff);margin-bottom:3px;">
                            ${ride.pickup.address.split(',')[0]} → ${ride.dropoff.address.split(',')[0]}
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-secondary,#a0a0a0);">
                            ${ride.distance} km · ${ride.duration} min · ${date}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700;font-size:1rem;color:var(--text-primary,#fff);">₹${ride.fare}</div>
                        <div style="font-size:0.65rem;font-weight:600;color:${statusColor};text-transform:uppercase;letter-spacing:0.3px;">${statusLabel}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error fetching ride history:', err);
        listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">Could not load rides.</p>';
    }
}

// Call ride history on dashboard page load
if (document.getElementById('rideHistoryList')) {
    document.addEventListener('DOMContentLoaded', fetchRideHistory);
}

// Fetch and render rental history
async function fetchRentalHistory() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const listEl = document.getElementById('rentalHistoryList');
    if (!listEl) return;

    try {
        const res = await fetch('/api/rentals', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">Could not load rentals.</p>';
            return;
        }

        const rentals = await res.json();

        if (rentals.length === 0) {
            listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">No rentals yet.</p>';
            return;
        }

        const vehicleIcons = { economy: '🚗', comfort: '🚙', premium: '🚘' };
        const packageLabels = {
            '1hr-10km': '1 Hr / 10 km',
            '2hr-20km': '2 Hrs / 20 km',
            '4hr-40km': '4 Hrs / 40 km'
        };
        const statusColors = {
            'pending': '#f59e0b', 'confirmed': '#3b82f6', 'driver-assigned': '#3b82f6',
            'in-progress': '#000', 'completed': '#10b981', 'cancelled': '#ef4444'
        };

        listEl.innerHTML = rentals.map(r => {
            const icon = vehicleIcons[r.vehicleType] || '🚗';
            const date = new Date(r.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const statusColor = statusColors[r.status] || '#888';
            const statusLabel = r.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

            return `
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--border-color,#333);">
                    <div style="font-size:1.8rem;min-width:40px;text-align:center;">${icon}</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary,#fff);margin-bottom:3px;">
                            ${r.pickup.address.split(',')[0]}
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-secondary,#a0a0a0);">
                            ${packageLabels[r.package] || r.package} · ${date}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700;font-size:1rem;color:var(--text-primary,#fff);">₹${r.fare}</div>
                        <div style="font-size:0.65rem;font-weight:600;color:${statusColor};text-transform:uppercase;letter-spacing:0.3px;">${statusLabel}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error fetching rental history:', err);
        listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">Could not load rentals.</p>';
    }
}

if (document.getElementById('rentalHistoryList')) {
    document.addEventListener('DOMContentLoaded', fetchRentalHistory);
}

// Fetch and render parcel history
async function fetchParcelHistory() {
    const token = localStorage.getItem('token');
    if (!token) return;

    const listEl = document.getElementById('parcelHistoryList');
    if (!listEl) return;

    try {
        const res = await fetch('/api/parcels', {
            headers: { 'Authorization': 'Bearer ' + token }
        });

        if (!res.ok) {
            listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">Could not load parcels.</p>';
            return;
        }

        const parcels = await res.json();

        if (parcels.length === 0) {
            listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">No parcels yet.</p>';
            return;
        }

        const sizeIcons = { small: '🏍️', medium: '🚗', large: '🚙' };
        const statusColors = {
            'pending': '#f59e0b', 'confirmed': '#3b82f6', 'picked-up': '#3b82f6',
            'in-transit': '#000', 'delivered': '#10b981', 'cancelled': '#ef4444'
        };

        listEl.innerHTML = parcels.map(p => {
            const icon = sizeIcons[p.packageSize] || '📦';
            const date = new Date(p.createdAt).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });
            const statusColor = statusColors[p.status] || '#888';
            const statusLabel = p.status.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase());

            return `
                <div style="display:flex;align-items:center;gap:1rem;padding:1rem 0;border-bottom:1px solid var(--border-color,#333);">
                    <div style="font-size:1.8rem;min-width:40px;text-align:center;">${icon}</div>
                    <div style="flex:1;">
                        <div style="font-weight:600;font-size:0.9rem;color:var(--text-primary,#fff);margin-bottom:3px;">
                            ${p.pickup.address.split(',')[0]} → ${p.dropoff.address.split(',')[0]}
                        </div>
                        <div style="font-size:0.75rem;color:var(--text-secondary,#a0a0a0);">
                            ${p.packageSize.charAt(0).toUpperCase() + p.packageSize.slice(1)} · ${p.distance} km · To: ${p.receiverName} · ${date}
                        </div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:700;font-size:1rem;color:var(--text-primary,#fff);">₹${p.fare}</div>
                        <div style="font-size:0.65rem;font-weight:600;color:${statusColor};text-transform:uppercase;letter-spacing:0.3px;">${statusLabel}</div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error('Error fetching parcel history:', err);
        listEl.innerHTML = '<p style="color:#a0a0a0;font-size:0.9rem;">Could not load parcels.</p>';
    }
}

if (document.getElementById('parcelHistoryList')) {
    document.addEventListener('DOMContentLoaded', fetchParcelHistory);
}
