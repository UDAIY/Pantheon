const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const fs = require('fs');

// Load env vars from backend/.env explicitly
dotenv.config({ path: path.join(__dirname, '.env') });

const isProd = process.env.NODE_ENV === 'production';
if (!process.env.MONGO_URI && isProd) {
    console.warn('WARNING: MONGO_URI is missing in production environment!');
}
if ((!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_secret_key') && isProd) {
    console.warn('WARNING: JWT_SECRET is missing or insecure in production environment!');
}
console.log('Environment variables loaded. MONGO_URI present:', !!process.env.MONGO_URI);

const authRoutes = require('./routes/auth');
const rideRoutes = require('./routes/rides');
const driverRoutes = require('./routes/drivers');
const rentalRoutes = require('./routes/rentals');
const parcelRoutes = require('./routes/parcels');
const onboardingRoutes = require('./routes/onboarding');
const adminRoutes = require('./routes/admin');

const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const io = new Server(server, {
    cors: { origin: '*' }
});

// Make io accessible in routes
app.set('io', io);

// Handle socket connections
require('./utils/socketHandler')(io);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, '../frontend', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer config for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|pdf/;
        const ext = allowed.test(path.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) return cb(null, true);
        cb(new Error('Only images (jpeg, jpg, png, webp) and PDFs are allowed.'));
    }
});

// Middleware
app.use(cors()); // Enable all CORS requests for consistency
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Apply multer to onboarding upload routes
app.use('/api/onboarding/step1', upload.single('document'));
app.use('/api/onboarding/step2', upload.single('document'));
app.use('/api/onboarding/step3', upload.single('document'));
app.use('/api/onboarding/step4', upload.single('document'));
app.use('/api/onboarding/step5', upload.single('document'));

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/auth_db')
    .then(() => console.log('MongoDB connected successfully'))
    .catch(err => {
        console.error('CRITICAL: MongoDB connection error:', err.message);
        // Do not exit in development to allow for frontend testing/debugging
        if (process.env.NODE_ENV === 'production') {
            process.exit(1);
        }
    });

// Middleware to check DB connection for API routes
const dbCheckMiddleware = (req, res, next) => {
    if (mongoose.connection.readyState !== 1) {
        return res.status(503).json({ 
            message: 'Database connection failed. If you are on a mobile hotspot, ' +
                     'please check your network or try a "standard" MongoDB connection string ' +
                     'in your .env file instead of the "srv" format.'
        });
    }
    next();
};

// Apply DB check only to API routes
app.use('/api', dbCheckMiddleware);

// Routes
app.use('/api', authRoutes);
app.use('/api', rideRoutes);
app.use('/api', driverRoutes);
app.use('/api', rentalRoutes);
app.use('/api', parcelRoutes);
app.use('/api', onboardingRoutes);
app.use('/api', adminRoutes);

// Catch-all route to serve dashboard for /dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'dashboard.html'));
});

app.get('/book', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'book.html'));
});

app.get('/ride-track', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'ride-track.html'));
});

app.get('/rental-book', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'rental-book.html'));
});

app.get('/parcel-book', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'parcel-book.html'));
});

app.get('/driver-onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'driver-onboarding.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'admin.html'));
});

// Catch-all route for any other request
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running locally on http://localhost:${PORT}`);

    // Dynamically get the network IP for the mobile hotspot connection
    const os = require('os');
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`Network access (Hotspot): http://${net.address}:${PORT}`);
            }
        }
    }
});
