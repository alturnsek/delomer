require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const app = express();

// Security headers
app.use(helmet());

// Rate limiting (basic anti-DDoS)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// CORS (restrict in production!)
app.use(cors({
  origin: 'http://localhost:3000'
}));

app.use(express.json());

// Routes
app.use('/api/users', require('./routes/users').default);
app.use('/api/work', require('./routes/work').default);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});




module.exports = app;
