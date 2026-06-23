
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    const token = req.cookies.token;

    console.log("TOKEN:", token);

    if (!token) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("DECODED:", decoded);

    req.user = decoded;

    next();

  } catch (err) {
    console.error("AUTH ERROR:", err);
    return res.status(401).json({ error: 'Invalid token' });
  }
};
