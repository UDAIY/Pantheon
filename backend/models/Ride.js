const mongoose = require('mongoose');

const RideSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickup: {
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    dropoff: {
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    vehicleType: { type: String, enum: ['economy', 'comfort', 'premium'], required: true },
    fare: { type: Number, required: true },
    distance: { type: Number, required: true }, // in km
    duration: { type: Number, required: true }, // in minutes
    status: {
        type: String,
        enum: ['pending', 'searching', 'confirmed', 'driver-assigned', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verificationPin: { type: String, default: null },
    pinVerified: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Ride', RideSchema);
