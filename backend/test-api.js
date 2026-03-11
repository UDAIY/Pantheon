const fs = require('fs');

async function testApi() {
    console.log('Testing /api/auth/login with a dummy user if none exists, or just checking the database...');
    const mongoose = require('mongoose');
    const dotenv = require('dotenv');
    dotenv.config();

    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db');
    console.log('Connected to DB');

    const User = require('./models/User');
    const users = await User.find({});
    console.log(`Found ${users.length} users in the database.`);

    if (users.length > 0) {
        const testUser = users[0];
        console.log(`First user: email=${testUser.email}, isVerified=${testUser.isVerified}`);

        // Let's create a token for this user to test /api/user/info
        const jwt = require('jsonwebtoken');
        const token = jwt.sign({ userId: testUser._id }, process.env.JWT_SECRET || 'fallback_secret_key', { expiresIn: '1h' });

        console.log(`Sending GET to /api/user/info with token...`);
        const res = await fetch('http://localhost:3000/api/user/info', {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`Response status: ${res.status}`);
        const data = await res.json();
        console.log(`Response data:`, data);
    } else {
        console.log('No users found to test.');
    }

    mongoose.disconnect();
}

testApi().catch(console.error);
