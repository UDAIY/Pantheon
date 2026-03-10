// driver-onboarding.js

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('token');
    if (!token) {
        window.location.href = '/driver-login.html';
        return;
    }

    // Fetch Auth user
    try {
        const userRes = await fetch('/api/user/info', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        const user = await userRes.json();
        if (user.role !== 'driver') {
            alert('Access denied. Drivers only.');
            window.location.href = '/login.html';
            return;
        }
    } catch (err) {
        console.error(err);
        window.location.href = '/driver-login.html';
        return;
    }

    // Fetch Onboarding Status
    async function loadStatus() {
        try {
            const res = await fetch('/api/onboarding/status', {
                headers: { 'Authorization': 'Bearer ' + token }
            });
            const profile = await res.json();

            updateStepStatus(1, profile.step1_license?.status);
            updateStepStatus(2, profile.step2_profilePhoto?.status);
            updateStepStatus(3, profile.step3_aadhaar?.status);
            updateStepStatus(4, profile.step4_rc?.status);
            updateStepStatus(5, profile.step5_insurance?.status);
            updateStepStatus(6, profile.step6_region?.status);

            // Activate the first pending step
            let activeSet = false;
            for (let i = 1; i <= 6; i++) {
                const s = document.getElementById(`step${i}Status`).textContent.toLowerCase();
                const card = document.getElementById(`step${i}Card`);

                if (s !== 'pending' && s !== '') {
                    card.classList.add('completed');
                    card.classList.remove('active');
                } else if (!activeSet) {
                    card.classList.add('active');
                    activeSet = true;
                } else {
                    card.classList.remove('active');
                }
            }

            if (profile.completedSteps === 6) {
                document.getElementById('stepsContainer').style.display = 'none';
                document.getElementById('completionMessage').style.display = 'block';
                // Automatically switch to approved for testing
                if (profile.overallStatus !== 'approved') {
                    // Force approval on backend (if simulation needed)
                }
            }

        } catch (err) {
            console.error('Failed to load status', err);
        }
    }

    function updateStepStatus(stepNum, statusString) {
        if (!statusString) return;
        const badge = document.getElementById(`step${stepNum}Status`);
        badge.textContent = statusString;
        if (statusString === 'approved' || statusString === 'submitted') {
            badge.style.color = 'var(--success-color)';
        }
    }

    await loadStatus();

    // Step Form Submissions
    async function submitFileStep(stepNum, url, dataEntries) {
        const formData = new FormData();
        dataEntries.forEach(entry => formData.append(entry[0], entry[1]));

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            alert(`Step ${stepNum} submitted successfully!`);
            await loadStatus();
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    }

    document.getElementById('step1Form').addEventListener('submit', (e) => {
        e.preventDefault();
        const entries = [
            ['licenseNumber', document.getElementById('licenseNumber').value],
            ['dob', document.getElementById('dob').value],
            ['document', document.getElementById('licenseDoc').files[0]]
        ];
        submitFileStep(1, '/api/onboarding/step1', entries);
    });

    document.getElementById('step2Form').addEventListener('submit', (e) => {
        e.preventDefault();
        const entries = [['document', document.getElementById('profilePhoto').files[0]]];
        submitFileStep(2, '/api/onboarding/step2', entries);
    });

    document.getElementById('step3Form').addEventListener('submit', (e) => {
        e.preventDefault();
        const entries = [
            ['consentGiven', document.getElementById('consentCb').checked],
            ['document', document.getElementById('aadhaarDoc').files[0]]
        ];
        submitFileStep(3, '/api/onboarding/step3', entries);
    });

    document.getElementById('step4Form').addEventListener('submit', (e) => {
        e.preventDefault();
        const entries = [
            ['vehicleRegNumber', document.getElementById('vehicleReg').value],
            ['document', document.getElementById('rcDoc').files[0]]
        ];
        submitFileStep(4, '/api/onboarding/step4', entries);
    });

    document.getElementById('step5Form').addEventListener('submit', (e) => {
        e.preventDefault();
        const entries = [
            ['licensePlate', document.getElementById('insurancePlate').value],
            ['document', document.getElementById('insuranceDoc').files[0]]
        ];
        submitFileStep(5, '/api/onboarding/step5', entries);
    });

    // Step 6 is JSON, not FormData
    document.getElementById('step6Form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const region = document.getElementById('opRegion').value;
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Saving...';

        try {
            const res = await fetch('/api/onboarding/step6', {
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ region })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            alert('Step 6 submitted successfully!');
            await loadStatus();
        } catch (err) {
            alert(`Error: ${err.message}`);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Finish Application';
        }
    });

});
