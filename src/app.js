const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// routes
const users = require('./routes/users');
const work = require('./routes/work');

const app = express();


// SECURITY

// HTTP headers protection
app.use(helmet());

// basic rate limiting (anti spam / brute force)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));


// CORS (za localhost test)
// kasneje zamenjaš z domeno
app.use(cors({
  origin: 'http://localhost:3000'
}));


// BODY PARSER
app.use(express.json());


// ROUTES
app.use('/api/users', users);
app.use('/api/work', work);


// STATIC HTML (frontend)

app.get('/', (req, res) => {
  res.sendFile(require('path').join(__dirname, 'public', 'index.html'));
});



// HEALTH CHECK (za Azure kasneje)
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.use(express.static(path.join(__dirname, 'public')));


// EXPORT
module.exports = app;
