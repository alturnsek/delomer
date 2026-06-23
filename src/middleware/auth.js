const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // header: Authorization: Bearer <token>
    const header = req.headers.authorization;

    if (!header) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const parts = header.split(' ');

    if (parts.length !== 2) {
      return res.status(401).json({ error: 'Token format invalid' });
    }

    const [scheme, token] = parts;

    if (scheme !== 'Bearer') {
      return res.status(401).json({ error: 'Token malformatted' });
    }

    // verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // attach user to request
    req.user = decoded;

    next();

  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};