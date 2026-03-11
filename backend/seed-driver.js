const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const DriverProfile = require('./models/DriverProfile');
const dotenv = require('dotenv');

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db')
    .then(async () => {
        console.log('MongoDB connected');

        const email = 'udaiyxyz@gmail.com';
        const password = '6969';

        // 0. Remove the unreal drivers from earlier setup
        const Driver = require('./models/Driver');
        await Driver.deleteMany({});
        console.log('Removed all old seeded drivers from the Driver collection.');

        // 1. Check if user exists, delete if so to make sure it's clean
        let user = await User.findOne({ email });
        if (user) {
            await DriverProfile.deleteMany({ userId: user._id });
            await User.deleteOne({ email });
            console.log('Deleted existing user to recreate clean driver state.');
        }

        // 2. Create the User explicitly as 'driver' and verified
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        user = new User({
            name: 'Udaiy Driver',
            email: email,
            password: passwordHash,
            role: 'driver',
            isVerified: true,
            operatingRegion: 'New Delhi', // Set to New Delhi by default
            isOnline: false
        });

        await user.save();
        console.log('Created User model for:', email);

        // 3. Create the fully approved DriverProfile
        const profile = new DriverProfile({
            userId: user._id,
            completedSteps: 6,
            overallStatus: 'approved',
            step1_license: { status: 'approved', licenseNumber: 'DL-123456789' },
            step2_profilePhoto: { status: 'approved' },
            step3_aadhaar: { status: 'approved' },
            step4_rc: { status: 'approved', vehicleRegNumber: 'DL-1-AB-1234' },
            step5_insurance: { status: 'approved' },
            step6_region: { status: 'approved', region: 'New Delhi' }
        });

        try {
            await profile.save();
            console.log('Created fully approved DriverProfile.');
        } catch (saveErr) {
            console.error('Error saving profile! Details:', saveErr.stack);
            process.exit(1);
        }

        console.log('\nSUCCESS! Driver account created.');
        console.log('Email:', email);
        console.log('Password:', password);
        console.log('You can now log in at http://localhost:3000/driver-login.html');

        process.exit(0);
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
