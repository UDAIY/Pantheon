const express = require('express');
const Driver = require('../models/Driver');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Seed sample drivers
router.post('/drivers/seed', async (req, res) => {
    try {
        const count = await Driver.countDocuments();
        if (count > 0) {
            return res.json({ message: `Drivers already seeded (${count} exist)` });
        }

        const sampleDrivers = [
            {
                name: 'Rajesh Kumar',
                phone: '+91 98765 43210',
                vehicle: { model: 'Maruti Swift', type: 'economy', plate: 'UP 32 AB 1234', color: 'White' },
                rating: 4.7,
                location: { lat: 26.8500, lng: 80.9500 },
                isAvailable: true
            },
            {
                name: 'Amit Sharma',
                phone: '+91 98765 43211',
                vehicle: { model: 'Hyundai i20', type: 'economy', plate: 'UP 32 CD 5678', color: 'Silver' },
                rating: 4.5,
                location: { lat: 26.8450, lng: 80.9400 },
                isAvailable: true
            },
            {
                name: 'Suresh Verma',
                phone: '+91 98765 43212',
                vehicle: { model: 'Honda City', type: 'comfort', plate: 'UP 32 EF 9012', color: 'Black' },
                rating: 4.8,
                location: { lat: 26.8520, lng: 80.9550 },
                isAvailable: true
            },
            {
                name: 'Vikram Singh',
                phone: '+91 98765 43213',
                vehicle: { model: 'Hyundai Verna', type: 'comfort', plate: 'UP 32 GH 3456', color: 'Blue' },
                rating: 4.6,
                location: { lat: 26.8480, lng: 80.9420 },
                isAvailable: true
            },
            {
                name: 'Pradeep Yadav',
                phone: '+91 98765 43214',
                vehicle: { model: 'Toyota Innova', type: 'premium', plate: 'UP 32 IJ 7890', color: 'White' },
                rating: 4.9,
                location: { lat: 26.8510, lng: 80.9480 },
                isAvailable: true
            },
            {
                name: 'Manoj Tiwari',
                phone: '+91 98765 43215',
                vehicle: { model: 'Maruti Alto', type: 'economy', plate: 'UP 32 KL 2345', color: 'Red' },
                rating: 4.3,
                location: { lat: 26.8440, lng: 80.9380 },
                isAvailable: true
            },
            {
                name: 'Deepak Gupta',
                phone: '+91 98765 43216',
                vehicle: { model: 'Honda Amaze', type: 'comfort', plate: 'UP 32 MN 6789', color: 'Grey' },
                rating: 4.7,
                location: { lat: 26.8530, lng: 80.9520 },
                isAvailable: true
            },
            {
                name: 'Rahul Mishra',
                phone: '+91 98765 43217',
                vehicle: { model: 'Toyota Fortuner', type: 'premium', plate: 'UP 32 OP 0123', color: 'Black' },
                rating: 4.8,
                location: { lat: 26.8460, lng: 80.9460 },
                isAvailable: true
            },
            {
                name: 'Arun Pandey',
                phone: '+91 98765 43218',
                vehicle: { model: 'Tata Nexon', type: 'economy', plate: 'UP 32 QR 4567', color: 'Blue' },
                rating: 4.4,
                location: { lat: 26.8490, lng: 80.9440 },
                isAvailable: true
            },
            {
                name: 'Sandeep Chauhan',
                phone: '+91 98765 43219',
                vehicle: { model: 'BMW 3 Series', type: 'premium', plate: 'UP 32 ST 8901', color: 'White' },
                rating: 4.9,
                location: { lat: 26.8470, lng: 80.9510 },
                isAvailable: true
            }
        ];

        await Driver.insertMany(sampleDrivers);
        res.status(201).json({ message: `${sampleDrivers.length} drivers seeded successfully` });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get nearby available drivers
router.get('/drivers/nearby', async (req, res) => {
    try {
        const drivers = await Driver.find({ isAvailable: true });
        res.json(drivers);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update driver online status
router.post('/driver/status', authMiddleware, async (req, res) => {
    try {
        const { isOnline } = req.body;
        const user = await User.findById(req.userId);
        if (!user || user.role !== 'driver') {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        user.isOnline = isOnline;
        await user.save();
        res.json({ message: `Status updated to ${isOnline ? 'Online' : 'Offline'}`, isOnline });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
