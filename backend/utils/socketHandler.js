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

                // Find if driver is currently on an active ride
                const activeRide = await require('../models/Ride').findOne({
                    driverId: socket.userId,
                    status: { $in: ['driver-assigned', 'in-progress'] }
                });

                if (activeRide) {
                    // Forward driver location to the passenger
                    io.to(activeRide.userId.toString()).emit('driver_location_update', {
                        lat: data.lat,
                        lng: data.lng,
                        rideId: activeRide._id
                    });
                }
            }
        });

        socket.on('passenger_message', async (data) => {
            // Forward passenger message to driver
            if (data.driverId && data.rideId) {
                io.to(data.driverId.toString()).emit('passenger_message', {
                    rideId: data.rideId,
                    message: data.message,
                    timestamp: data.timestamp
                });
                console.log(`Message from passenger to driver ${data.driverId}: "${data.message}"`);
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
