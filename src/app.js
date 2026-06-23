const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

require('dotenv').config();

// routes
const users = require('./routes/users');
const work = require('./routes/work');

const app = express();


// SECURITY
app.use(helmet());

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));


// CORS (mora imeti credentials za cookies)
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));


// PARSERJI
app.use(express.json());
app.use(cookieParser());


// STATIC FILES (to mora biti pred app.get('/'))
app.use(express.static(path.join(__dirname, 'public')));


// API ROUTES
app.use('/api/users', users);
app.use('/api/work', work);


// HTML (glavna stran)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});


// HEALTH CHECK
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});


module.exports = app;