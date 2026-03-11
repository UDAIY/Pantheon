// utils/socketHandler.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

module.exports = function (io) {
    // Middleware for socket auth
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error('Authentication error'));

            const decoded = jwt.verify(token, JWT_SECRET);
            socket.userId = decoded.userId;
            socket.userRole = decoded.role;

            // Link socket to user
            await User.findByIdAndUpdate(socket.userId, {
                socketId: socket.id,
                isOnline: true
            });

            next();
        } catch (err) {
            next(new Error('Authentication error'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.userId} (${socket.id})`);

        // User joins a room specific to their unique ID so they can receive direct targeted events
        socket.join(socket.userId);

        // Upon connecting, if it's a driver we can join them to a region room
        if (socket.userRole === 'driver') {
            User.findById(socket.userId).then(user => {
                if (user && user.operatingRegion) {
                    socket.join(user.operatingRegion);
                    console.log(`Driver ${user.name} joined room: ${user.operatingRegion}`);
                }
            });
        }

        socket.on('update_location', async (data) => {
            if (socket.userRole === 'driver') {
                await User.findByIdAndUpdate(socket.userId, {
                    'location.lat': data.lat,
                    'location.lng': data.lng
                });
            }
        });

        socket.on('disconnect', async () => {
            console.log(`User disconnected: ${socket.userId}`);
            await User.findByIdAndUpdate(socket.userId, {
                socketId: null,
                isOnline: false
            });
        });
    });
};
