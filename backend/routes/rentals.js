const express = require('express');
const Rental = require('../models/Rental');
const Driver = require('../models/Driver');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Fare per hour for each vehicle type
const RENTAL_RATES = {
    economy: 150,
    comfort: 250,
    premium: 400
};

// Package definitions: hours and km allowance
const PACKAGES = {
    '1hr-10km': { hours: 1, km: 10 },
    '2hr-20km': { hours: 2, km: 20 },
    '4hr-40km': { hours: 4, km: 40 }
};

// Create a new rental
router.post('/rentals', authMiddleware, async (req, res) => {
    try {
        const { pickup, packageType, vehicleType } = req.body;

        if (!pickup || !packageType || !vehicleType) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!PACKAGES[packageType]) {
            return res.status(400).json({ message: 'Invalid package type' });
        }

        if (!RENTAL_RATES[vehicleType]) {
            return res.status(400).json({ message: 'Invalid vehicle type' });
        }

        const pkg = PACKAGES[packageType];
        const fare = RENTAL_RATES[vehicleType] * pkg.hours;

        const rental = new Rental({
            userId: req.userId,
            pickup,
            package: packageType,
            vehicleType,
            fare,
            status: 'pending'
        });

        await rental.save();
        res.status(201).json(rental);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Confirm rental & assign a driver
router.post('/rentals/:id/confirm', authMiddleware, async (req, res) => {
    try {
        const rental = await Rental.findById(req.params.id);
        if (!rental) return res.status(404).json({ message: 'Rental not found' });
        if (rental.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        if (rental.status !== 'pending') {
            return res.status(400).json({ message: 'Rental cannot be confirmed in its current state' });
        }

        // Find available drivers
        let drivers = await Driver.find({
            isAvailable: true,
            'vehicle.type': rental.vehicleType
        });

        if (drivers.length === 0) {
            drivers = await Driver.find({ isAvailable: true });
        }

        if (drivers.length === 0) {
            return res.status(400).json({ message: 'No drivers available at the moment. Please try again.' });
        }

        const assignedDriver = drivers[Math.floor(Math.random() * drivers.length)];

        rental.status = 'driver-assigned';
        rental.driverId = assignedDriver._id;
        await rental.save();

        assignedDriver.isAvailable = false;
        await assignedDriver.save();

        const populatedRental = await Rental.findById(rental._id).populate('driverId');
        res.json(populatedRental);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel a rental
router.post('/rentals/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const rental = await Rental.findById(req.params.id);
        if (!rental) return res.status(404).json({ message: 'Rental not found' });
        if (rental.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (['completed', 'cancelled'].includes(rental.status)) {
            return res.status(400).json({ message: 'Rental cannot be cancelled' });
        }

        if (rental.driverId) {
            await Driver.findByIdAndUpdate(rental.driverId, { isAvailable: true });
        }

        rental.status = 'cancelled';
        await rental.save();
        res.json({ message: 'Rental cancelled', rental });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get rental history
router.get('/rentals', authMiddleware, async (req, res) => {
    try {
        const rentals = await Rental.find({ userId: req.userId })
            .populate('driverId')
            .sort({ createdAt: -1 });
        res.json(rentals);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
