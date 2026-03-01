const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load env vars
dotenv.config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db')
    .then(async () => {
        console.log('MongoDB connected');

        // Make sure User model is registered after connection
        const User = require('./models/User');

        const result = await User.deleteMany({});
        console.log(`Successfully deleted ${result.deletedCount} users from MongoDB.`);
        process.exit(0);
    })
    .catch(err => {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    });
