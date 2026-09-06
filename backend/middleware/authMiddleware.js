const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'tradepulse_jwt_secret_key_2026';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
}

function generateToken(user) {
    return jwt.sign(
        { id: user._id.toString(), email: user.email, name: user.name },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

module.exports = {
    authenticateToken,
    generateToken,
    JWT_SECRET
};
