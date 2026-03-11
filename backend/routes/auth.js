const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const DriverProfile = require('../models/DriverProfile');
const authMiddleware = require('../middleware/authMiddleware');
const sendEmail = require('../utils/sendEmail');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

// Register Route
router.post('/auth/register', async (req, res) => {
    try {
        const { name, email, password, role, phone } = req.body;

        // Validate role
        const validRoles = ['user', 'driver'];
        const userRole = validRoles.includes(role) ? role : 'user';

        // Check if user exists
        const existingUser = await User.findOne({ email });
        if (existingUser) return res.status(400).json({ message: 'User already exists' });

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Save new user
        const newUser = new User({
            name,
            email,
            password: hashedPassword,
            role: userRole,
            phone: phone || undefined
        });

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        // 10 minutes expiration
        const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

        newUser.otp = otp;
        newUser.otpExpires = otpExpires;

        await newUser.save();

        // If driver, create empty DriverProfile
        if (userRole === 'driver') {
            const profile = new DriverProfile({ userId: newUser._id });
            await profile.save();
        }

        console.log(`\n=== TEST MODE OTP ===`);
        console.log(`OTP for ${email}: ${otp} (role: ${userRole})`);
        console.log(`=======================\n`);

        // Send OTP email
        const emailMessage = `Your OTP for registration is: ${otp}\nThis OTP is valid for 10 minutes.\n\nWelcome to the platform!`;
        // Don't wait for email to send to avoid blocking the response
        sendEmail({
            email: newUser.email,
            subject: 'Email Verification OTP',
            message: emailMessage
        }).catch(err => console.error('Failed to send email:', err.message || err));

        res.status(201).json({ message: 'User registered successfully. Please verify your OTP.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Login Route
router.post('/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });

        // Compare password
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        // Check verification
        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email address before logging in' });
        }

        // Generate Token (include role)
        const token = jwt.sign({ userId: user._id, role: user.role }, JWT_SECRET, { expiresIn: '24h' });

        // If driver, check onboarding status
        let onboardingComplete = true;
        if (user.role === 'driver') {
            const profile = await DriverProfile.findOne({ userId: user._id });
            onboardingComplete = profile ? profile.overallStatus === 'approved' : false;
        }

        res.json({
            token,
            user: { name: user.name, email: user.email, role: user.role },
            onboardingComplete
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Protected Route for Fetching User Dashboard Data
router.get('/user/info', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        if (!user) return res.status(404).json({ message: 'User not found' });

        const userData = user.toObject();

        // If driver, include onboarding status
        if (user.role === 'driver') {
            const profile = await DriverProfile.findOne({ userId: user._id });
            userData.onboardingComplete = profile ? profile.overallStatus === 'approved' : false;
            userData.completedSteps = profile ? profile.completedSteps : 0;
        }

        res.json(userData);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify OTP Route
router.post('/auth/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;

        if (!email || !otp) {
            return res.status(400).json({ message: 'Email and OTP are required' });
        }

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (user.isVerified) {
            return res.status(400).json({ message: 'User is already verified' });
        }

        // Check if OTP matches and is not expired
        if (user.otp !== otp) {
            return res.status(400).json({ message: 'Invalid OTP' });
        }

        if (user.otpExpires < new Date()) {
            return res.status(400).json({ message: 'OTP has expired. Please register again or request a new OTP.' });
        }

        // Mark as verified
        user.isVerified = true;
        user.otp = undefined;
        user.otpExpires = undefined;

        await user.save();

        res.status(200).json({ message: 'Email verified successfully. You can now log in.' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
