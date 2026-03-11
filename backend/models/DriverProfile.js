const mongoose = require('mongoose');

const stepStatusEnum = ['pending', 'submitted', 'approved', 'rejected'];

const DriverProfileSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    completedSteps: { type: Number, default: 0, min: 0, max: 6 },

    step1_license: {
        licenseNumber: { type: String },
        dob: { type: String },
        documentPath: { type: String },
        status: { type: String, enum: stepStatusEnum, default: 'pending' }
    },
    step2_profilePhoto: {
        photoPath: { type: String },
        status: { type: String, enum: stepStatusEnum, default: 'pending' }
    },
    step3_aadhaar: {
        photoPath: { type: String },
        consentGiven: { type: Boolean, default: false },
        status: { type: String, enum: stepStatusEnum, default: 'pending' }
    },
    step4_rc: {
        vehicleRegNumber: { type: String },
        documentPath: { type: String },
        status: { type: String, enum: stepStatusEnum, default: 'pending' }
    },
    step5_insurance: {
        licensePlate: { type: String },
        documentPath: { type: String },
        status: { type: String, enum: stepStatusEnum, default: 'pending' }
    },
    step6_region: {
        region: { type: String },
        status: { type: String, enum: stepStatusEnum, default: 'pending' }
    },

    overallStatus: {
        type: String,
        enum: ['incomplete', 'pending_review', 'approved', 'rejected'],
        default: 'incomplete'
    }
}, { timestamps: true });

// Recalculate completedSteps before saving
DriverProfileSchema.pre('save', function () {
    let count = 0;
    if (this.step1_license && this.step1_license.status !== 'pending') count++;
    if (this.step2_profilePhoto && this.step2_profilePhoto.status !== 'pending') count++;
    if (this.step3_aadhaar && this.step3_aadhaar.status !== 'pending') count++;
    if (this.step4_rc && this.step4_rc.status !== 'pending') count++;
    if (this.step5_insurance && this.step5_insurance.status !== 'pending') count++;
    if (this.step6_region && this.step6_region.status !== 'pending') count++;
    this.completedSteps = count;

    // Auto-set overall status
    if (count === 6 && (this.overallStatus === 'incomplete' || this.overallStatus === 'pending_review')) {
        this.overallStatus = 'approved';
    }
});

module.exports = mongoose.model('DriverProfile', DriverProfileSchema);
