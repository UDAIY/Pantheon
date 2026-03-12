const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    phone: { type: String },
    role: { type: String, enum: ['user', 'driver', 'admin'], default: 'user' },
    isVerified: { type: Boolean, default: false },
    otp: { type: String },
    otpExpires: { type: Date },
    operatingRegion: { type: String },
    isOnline: { type: Boolean, default: false },
    socketId: { type: String },
    location: {
        lat: { type: Number },
        lng: { type: Number }
    },
    // Driver-specific fields
    vehicle: {
        model: { type: String },
        type: { type: String, enum: ['economy', 'comfort', 'premium'] },
        plate: { type: String },
        color: { type: String }
    },
    rating: { type: Number, default: 5.0, min: 1, max: 5 }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
