// driver-auth.js

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('driverRegisterForm');
    const otpForm = document.getElementById('otpForm');
    const loginForm = document.getElementById('driverLoginForm');

    // Register Flow
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('registerBtn');
            const msg = document.getElementById('registerMessage');

            const payload = {
                name: document.getElementById('regName').value,
                email: document.getElementById('regEmail').value,
                phone: document.getElementById('regPhone').value,
                password: document.getElementById('regPassword').value,
                role: 'driver'
            };

            btn.disabled = true;
            btn.textContent = 'Creating Account...';
            msg.className = 'message';
            msg.textContent = '';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Registration failed');

                // Show OTP form
                registerForm.style.display = 'none';
                otpForm.style.display = 'block';

                // Store email globally to use for OTP validation
                window.registeredEmail = payload.email;
                document.getElementById('switchFormText').style.display = 'none';

            } catch (err) {
                msg.className = 'message error';
                msg.textContent = err.message;
            } finally {
                btn.disabled = false;
                btn.textContent = 'Create Driver Account';
            }
        });
    }

    // OTP Verfication
    if (otpForm) {
        otpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('otpBtn');
            const msg = document.getElementById('otpMessage');

            const otpCode = document.getElementById('otpInput').value;
            const payload = { email: window.registeredEmail, otp: otpCode };

            btn.disabled = true;
            btn.textContent = 'Verifying...';
            msg.className = 'message';
            msg.textContent = '';

            try {
                const res = await fetch('/api/auth/verify-otp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Verification failed');

                msg.className = 'message success';
                msg.textContent = 'Success! Redirecting to login...';

                setTimeout(() => {
                    window.location.href = '/driver-login.html';
                }, 2000);
            } catch (err) {
                msg.className = 'message error';
                msg.textContent = err.message;
                btn.disabled = false;
                btn.textContent = 'Verify Email';
            }
        });
    }

    // Login Flow
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('loginBtn');
            const msg = document.getElementById('loginMessage');

            const payload = {
                email: document.getElementById('loginEmail').value,
                password: document.getElementById('loginPassword').value
            };

            btn.disabled = true;
            btn.textContent = 'Logging in...';
            msg.className = 'message';
            msg.textContent = '';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok) throw new Error(data.message || 'Login failed');

                if (data.user.role !== 'driver') {
                    throw new Error('This portal is only for drivers. Please use the passenger login.');
                }

                // Store auth
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                if (!data.onboardingComplete) {
                    window.location.href = '/driver-onboarding.html';
                } else {
                    window.location.href = '/driver-dashboard.html';
                }

            } catch (err) {
                msg.className = 'message error';
                msg.textContent = err.message;
                btn.disabled = false;
                btn.textContent = 'Login as Driver';
            }
        });
    }
});
