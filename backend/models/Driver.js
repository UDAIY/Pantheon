const mongoose = require('mongoose');

const DriverSchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, required: true },
    vehicle: {
        model: { type: String, required: true },
        type: { type: String, enum: ['economy', 'comfort', 'premium'], required: true },
        plate: { type: String, required: true },
        color: { type: String, required: true }
    },
    rating: { type: Number, default: 4.5, min: 1, max: 5 },
    location: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('Driver', DriverSchema);
