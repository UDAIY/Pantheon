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
                window.location.href = '/dashboard.html';
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
        const messageEl = document.getElementById('registerMessage');

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
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
