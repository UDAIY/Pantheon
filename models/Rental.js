const mongoose = require('mongoose');

const RentalSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    pickup: {
        address: { type: String, required: true },
        lat: { type: Number, required: true },
        lng: { type: Number, required: true }
    },
    package: { type: String, enum: ['1hr-10km', '2hr-20km', '4hr-40km'], required: true },
    vehicleType: { type: String, enum: ['economy', 'comfort', 'premium'], required: true },
    fare: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'driver-assigned', 'in-progress', 'completed', 'cancelled'],
        default: 'pending'
    },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'Driver', default: null }
}, { timestamps: true });

module.exports = mongoose.model('Rental', RentalSchema);
