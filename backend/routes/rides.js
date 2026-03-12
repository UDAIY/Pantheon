const express = require('express');
const Ride = require('../models/Ride');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Fare rates per km for each vehicle type (in ₹)
const FARE_RATES = {
    economy: 8,
    comfort: 12,
    premium: 18
};

// Base fare added to every ride
const BASE_FARE = 25;

// Create a new ride
router.post('/rides', authMiddleware, async (req, res) => {
    try {
        const { pickup, dropoff, vehicleType, distance, duration } = req.body;

        if (!pickup || !dropoff || !vehicleType || !distance || !duration) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        if (!FARE_RATES[vehicleType]) {
            return res.status(400).json({ message: 'Invalid vehicle type' });
        }

        // Calculate fare server-side
        const distanceKm = parseFloat(distance);
        const fare = Math.round(BASE_FARE + (distanceKm * FARE_RATES[vehicleType]));

        const ride = new Ride({
            userId: req.userId,
            pickup,
            dropoff,
            vehicleType,
            fare,
            distance: distanceKm,
            duration: parseFloat(duration),
            status: 'pending'
        });

        await ride.save();
        res.status(201).json(ride);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Confirm ride & assign a driver
router.post('/rides/:id/confirm', authMiddleware, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        if (ride.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        if (ride.status !== 'pending') {
            return res.status(400).json({ message: 'Ride cannot be confirmed in its current state' });
        }

        // Determine the region from the pickup address
        const availableRegions = ['New Delhi', 'Mumbai', 'Bengaluru', 'Lucknow'];
        let region = 'New Delhi'; // Default
        for (const r of availableRegions) {
            if (ride.pickup.address.toLowerCase().includes(r.toLowerCase())) {
                region = r;
                break;
            }
        }

        const io = req.app.get('io');
        if (io) {
            console.log(`Broadcasting ride ${ride._id} to region: ${region}`);
            io.to(region).emit('new_ride_request', ride);
        }

        // Update ride status to broadcasted (waiting for driver)
        ride.status = 'searching';
        await ride.save();

        res.json({ message: 'Searching for drivers...', ride });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Driver accepts a ride
router.post('/rides/:id/accept', authMiddleware, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });

        // Ensure user is driver
        const driver = await User.findById(req.userId);
        if (!driver || driver.role !== 'driver') {
            return res.status(403).json({ message: 'Unauthorized. Only drivers can accept rides.' });
        }

        if (ride.status !== 'searching') {
            return res.status(400).json({ message: 'Ride has already been accepted or is no longer available.' });
        }

        // Generate random 4-digit PIN
        const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();

        // Assign driver
        ride.status = 'driver-assigned';
        ride.driverId = driver._id;
        ride.verificationPin = verificationPin;
        ride.pinVerified = false;
        await ride.save();

        // Populate driver info so the passenger has it!
        await ride.populate('driverId');

        // Mark driver as unavailable
        driver.isOnline = false; // Or just busy
        await driver.save();

        res.json({ message: 'Ride accepted successfully', ride });

        // Notify the specific passenger via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.to(ride.userId.toString()).emit('ride_accepted', ride);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify PIN and confirm ride
router.post('/rides/:id/verify-pin', authMiddleware, async (req, res) => {
    try {
        const { pin } = req.body;
        const ride = await Ride.findById(req.params.id);
        
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        
        // Ensure user is driver
        const driver = await User.findById(req.userId);
        if (!driver || driver.role !== 'driver' || ride.driverId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        
        if (ride.verificationPin !== pin) {
            return res.status(400).json({ message: 'Invalid PIN' });
        }
        
        // PIN verified - update ride status to in-progress
        ride.pinVerified = true;
        ride.status = 'in-progress';
        await ride.save();
        await ride.populate('driverId');
        
        res.json({ message: 'PIN verified. Ride confirmed!', ride });
        
        // Notify passenger that ride is confirmed
        const io = req.app.get('io');
        if (io) {
            io.to(ride.userId.toString()).emit('ride_confirmed', ride);
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Cancel a ride
router.post('/rides/:id/cancel', authMiddleware, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        if (ride.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        if (['completed', 'cancelled'].includes(ride.status)) {
            return res.status(400).json({ message: 'Ride cannot be cancelled' });
        }

        // Get passenger info for notification
        const passenger = await User.findById(ride.userId);

        // Free up the driver if one was assigned
        if (ride.driverId) {
            await User.findByIdAndUpdate(ride.driverId, { isOnline: true });
            
            // Notify driver via Socket.IO
            const io = req.app.get('io');
            if (io) {
                io.to(ride.driverId.toString()).emit('ride_cancelled', {
                    rideId: ride._id,
                    passengerName: passenger?.name || 'Passenger',
                    pickup: ride.pickup,
                    reason: 'Passenger cancelled the ride'
                });
                console.log(`Ride ${ride._id} cancelled. Notified driver ${ride.driverId}`);
            }
        }

        ride.status = 'cancelled';
        await ride.save();
        res.json({ message: 'Ride cancelled', ride });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Complete a ride (called from tracking page when simulation finishes)
router.post('/rides/:id/complete', authMiddleware, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id);
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        if (ride.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        ride.status = 'completed';
        await ride.save();

        // Free up the driver
        if (ride.driverId) {
            await User.findByIdAndUpdate(ride.driverId, { isOnline: true });
        }

        res.json({ message: 'Ride completed', ride });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get single ride with driver info
router.get('/rides/:id', authMiddleware, async (req, res) => {
    try {
        const ride = await Ride.findById(req.params.id).populate('driverId');
        if (!ride) return res.status(404).json({ message: 'Ride not found' });
        if (ride.userId.toString() !== req.userId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }
        res.json(ride);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get ride history for logged-in user
router.get('/rides', authMiddleware, async (req, res) => {
    try {
        const rides = await Ride.find({ userId: req.userId })
            .populate('driverId')
            .sort({ createdAt: -1 });
        res.json(rides);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get fare estimates (no auth needed for landing page)
router.get('/rides/estimate', async (req, res) => {
    try {
        const { distance } = req.query;
        if (!distance) return res.status(400).json({ message: 'Distance is required' });

        const distanceKm = parseFloat(distance);
        const estimates = {
            economy: Math.round(BASE_FARE + (distanceKm * FARE_RATES.economy)),
            comfort: Math.round(BASE_FARE + (distanceKm * FARE_RATES.comfort)),
            premium: Math.round(BASE_FARE + (distanceKm * FARE_RATES.premium))
        };
        res.json(estimates);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
