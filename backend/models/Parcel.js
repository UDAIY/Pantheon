const mongoose = require('mongoose');

const ParcelSchema = new mongoose.Schema({
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
    receiverName: { type: String, required: true },
    receiverPhone: { type: String, required: true },
    instructions: { type: String, default: '' },
    packageSize: { type: String, enum: ['small', 'medium', 'large'], required: true },
    vehicleType: { type: String, enum: ['bike', 'car', 'suv'], required: true },
    fare: { type: Number, required: true },
    distance: { type: Number, required: true },
    duration: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'driver-assigned', 'picked-up', 'in-transit', 'delivered', 'cancelled'],
        default: 'pending'
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Parcel', ParcelSchema);
