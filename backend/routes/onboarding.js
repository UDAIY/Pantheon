const express = require('express');
const path = require('path');
const fs = require('fs');
const DriverProfile = require('../models/DriverProfile');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();

// All onboarding routes require auth + driver role
router.use('/onboarding', authMiddleware, requireRole('driver'));

// GET /api/onboarding/status — Return full onboarding state
router.get('/onboarding/status', async (req, res) => {
    try {
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) {
            return res.status(404).json({ message: 'Driver profile not found.' });
        }
        res.json(profile);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Helper: handle file upload for a step
function handleFileUpload(req) {
    if (req.file) {
        return '/uploads/' + req.file.filename;
    }
    return null;
}

// POST /api/onboarding/step1 — Driving License
router.post('/onboarding/step1', async (req, res) => {
    try {
        const { licenseNumber, dob } = req.body;
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        const documentPath = handleFileUpload(req);

        profile.step1_license = {
            licenseNumber: licenseNumber || profile.step1_license.licenseNumber,
            dob: dob || profile.step1_license.dob,
            documentPath: documentPath || profile.step1_license.documentPath,
            status: 'submitted'
        };

        await profile.save();
        res.json({ message: 'Step 1 saved successfully.', completedSteps: profile.completedSteps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/onboarding/step2 — Profile Photo
router.post('/onboarding/step2', async (req, res) => {
    try {
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        const photoPath = handleFileUpload(req);
        if (!photoPath) {
            return res.status(400).json({ message: 'Profile photo is required.' });
        }

        profile.step2_profilePhoto = {
            photoPath,
            status: 'submitted'
        };

        await profile.save();
        res.json({ message: 'Step 2 saved successfully.', completedSteps: profile.completedSteps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/onboarding/step3 — Aadhaar Card
router.post('/onboarding/step3', async (req, res) => {
    try {
        const { consentGiven } = req.body;
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        if (!consentGiven || consentGiven === 'false') {
            return res.status(400).json({ message: 'You must consent to share Aadhaar details for verification.' });
        }

        const photoPath = handleFileUpload(req);
        if (!photoPath) {
            return res.status(400).json({ message: 'Aadhaar photo is required.' });
        }

        profile.step3_aadhaar = {
            photoPath,
            consentGiven: true,
            status: 'submitted'
        };

        await profile.save();
        res.json({ message: 'Step 3 saved successfully.', completedSteps: profile.completedSteps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/onboarding/step4 — Registration Certificate (RC)
router.post('/onboarding/step4', async (req, res) => {
    try {
        const { vehicleRegNumber } = req.body;
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        const documentPath = handleFileUpload(req);

        profile.step4_rc = {
            vehicleRegNumber: vehicleRegNumber || profile.step4_rc.vehicleRegNumber,
            documentPath: documentPath || profile.step4_rc.documentPath,
            status: 'submitted'
        };

        await profile.save();
        res.json({ message: 'Step 4 saved successfully.', completedSteps: profile.completedSteps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/onboarding/step5 — Vehicle Insurance
router.post('/onboarding/step5', async (req, res) => {
    try {
        const { licensePlate } = req.body;
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        const documentPath = handleFileUpload(req);

        profile.step5_insurance = {
            licensePlate: licensePlate || profile.step5_insurance.licensePlate,
            documentPath: documentPath || profile.step5_insurance.documentPath,
            status: 'submitted'
        };

        await profile.save();
        res.json({ message: 'Step 5 saved successfully.', completedSteps: profile.completedSteps });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/onboarding/step6 — Operating Region
router.post('/onboarding/step6', async (req, res) => {
    try {
        const { region } = req.body;
        const profile = await DriverProfile.findOne({ userId: req.userId });
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        if (!region) {
            return res.status(400).json({ message: 'Region selection is required.' });
        }

        profile.step6_region = {
            region,
            status: 'submitted'
        };

        // Also update the User model so it's readily accessible
        const User = require('../models/User');
        await User.findByIdAndUpdate(req.userId, { operatingRegion: region });

        await profile.save();
        res.json({ message: 'Step 6 saved successfully.', completedSteps: profile.completedSteps, overallStatus: profile.overallStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
