const express = require('express');
const Parcel = require('../models/Parcel');
const Driver = require('../models/Driver');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Fare rates per km for each package size
const PARCEL_RATES = {
    small: { rate: 5, base: 20, vehicle: 'bike' },
    medium: { rate: 8, base: 25, vehicle: 'car' },
    large: { rate: 12, base: 35, vehicle: 'suv' }
};

// Create a new parcel delivery
router.post('/parcels', authMiddleware, async (req, res) => {
    try {
        const { pickup, dropoff, receiverName, receiverPhone, instructions, packageSize, distance, duration } = req.body;

        if (!pickup || !dropoff || !receiverName || !receiverPhone || !packageSize || !distance || !duration) {
            return res.status(400).json({ message: 'All required fields must be provided' });
        }

        if (!PARCEL_RATES[packageSize]) {
            return res.status(400).json({ message: 'Invalid package size' });
        }

        const pricing = PARCEL_RATES[packageSize];
        const distanceKm = parseFloat(distance);
        const fare = Math.round(pricing.base + (distanceKm * pricing.rate));

        const parcel = new Parcel({
            userId: req.userId,
            pickup,
            dropoff,
            receiverName,
            receiverPhone,
            instructions: instructions || '',
            packageSize,
            vehicleType: pricing.vehicle,
            fare,
            distance: distanceKm,
            duration: parseFloat(duration),
            status: 'pending'
        });

        await parcel.save();
        res.status(201).json(parcel);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Confirm parcel & assign driver
router.post('/parcels/:id/confirm', authMiddleware, async (req, res) => {
    try {
        const parcel = await Parcel.findById(req.params.id);
        if (!parcel) return res.status(404).json({ message: 'Parcel not found' });
        if (parcel.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        if (parcel.status !== 'pending') {
            return res.status(400).json({ message: 'Parcel cannot be confirmed in its current state' });
        }

        let drivers = await Driver.find({ isAvailable: true });

        if (drivers.length === 0) {
            return res.status(400).json({ message: 'No drivers available at the moment. Please try again.' });
        }

        const assignedDriver = drivers[Math.floor(Math.random() * drivers.length)];

        parcel.status = 'confirmed';
        parcel.driverId = assignedDriver._id;
        await parcel.save();

        assignedDriver.isAvailable = false;
        await assignedDriver.save();

        const populatedParcel = await Parcel.findById(parcel._id).populate('driverId');
        res.json(populatedParcel);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel a parcel
router.post('/parcels/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const parcel = await Parcel.findById(req.params.id);
        if (!parcel) return res.status(404).json({ message: 'Parcel not found' });
        if (parcel.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (['delivered', 'cancelled'].includes(parcel.status)) {
            return res.status(400).json({ message: 'Parcel cannot be cancelled' });
        }

        if (parcel.driverId) {
            await Driver.findByIdAndUpdate(parcel.driverId, { isAvailable: true });
        }

        parcel.status = 'cancelled';
        await parcel.save();
        res.json({ message: 'Parcel cancelled', parcel });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get parcel history
router.get('/parcels', authMiddleware, async (req, res) => {
    try {
        const parcels = await Parcel.find({ userId: req.userId })
            .populate('driverId')
            .sort({ createdAt: -1 });
        res.json(parcels);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
