/**
 * Role-based access control middleware.
 * Usage: requireRole('admin') or requireRole('driver', 'admin')
 */
const requireRole = (...roles) => {
    return (req, res, next) => {
        if (!req.userRole) {
            return res.status(401).json({ message: 'Authentication required.' });
        }
        if (!roles.includes(req.userRole)) {
            return res.status(403).json({ message: 'Access denied. Insufficient permissions.' });
        }
        next();
    };
};

module.exports = { requireRole };
