const express = require('express');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const authMiddleware = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');

const router = express.Router();

// All admin routes require auth + admin role
router.use('/admin', authMiddleware, requireRole('admin'));

// GET /api/admin/users — List all users
router.get('/admin/users', async (req, res) => {
    try {
        const users = await User.find().select('-password -otp -otpExpires');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// GET /api/admin/drivers — List all driver profiles with user info
router.get('/admin/drivers', async (req, res) => {
    try {
        const profiles = await DriverProfile.find().populate('userId', 'name email phone');
        res.json(profiles);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/drivers/:id/approve — Approve a driver
router.post('/admin/drivers/:id/approve', async (req, res) => {
    try {
        const profile = await DriverProfile.findById(req.params.id);
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        profile.overallStatus = 'approved';
        await profile.save();

        res.json({ message: 'Driver approved successfully.', overallStatus: profile.overallStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// POST /api/admin/drivers/:id/reject — Reject a driver
router.post('/admin/drivers/:id/reject', async (req, res) => {
    try {
        const profile = await DriverProfile.findById(req.params.id);
        if (!profile) return res.status(404).json({ message: 'Driver profile not found.' });

        profile.overallStatus = 'rejected';
        await profile.save();

        res.json({ message: 'Driver rejected.', overallStatus: profile.overallStatus });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
