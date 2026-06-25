const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const session = require("express-session");
const passport = require("passport");

require("dotenv").config();

// routes
const users = require("./routes/users");
const work = require("./routes/work");

// ✅ passport config
require("./config/passport");

const app = express();

/* =========================
   ✅ DEBUG (optional)
========================= */
app.use((req, res, next) => {
  console.log("COOKIE HEADER:", req.headers.cookie);
  next();
});

/* =========================
   ✅ SECURITY
========================= */
app.use(helmet());

/*app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100
  })
);*/

/* =========================
   ✅ CORS (FIXED)
========================= */
app.use(
  cors({
    origin: true, // ✅ BREZ narekovajev!
    credentials: true
  })
);

/* =========================
   ✅ PARSERJI
========================= */
app.use(express.json());

/* =========================
   ✅ SESSION (FIXED)
========================= */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    rolling: true, // ✅ BREZ narekovajev!
    cookie: {
      httpOnly: true,
      secure: false, // production → true (HTTPS)
      sameSite: "lax"
    }
  })
);

/* =========================
   ✅ PASSPORT (order important!)
========================= */
app.use(passport.initialize());
app.use(passport.session());

/* =========================
   ✅ STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   ✅ ROUTES
========================= */
app.use("/api/users", users);
app.use("/api/work", work);

/* =========================
   ✅ AUTH CHECK
========================= */
app.get("/api/me", (req, res) => {
  if (!req.user) {
    return res.json({ loggedIn: false });
  }

  res.json({
    loggedIn: true,
    user: {
      id: req.user.id,
      email: req.user.email,
      first_name: req.user.first_name,
      last_name: req.user.last_name
    }
  });
});

/* =========================
   ✅ HTML
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
   ✅ HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

/* =========================
   ✅ TRUST PROXY (optional)
========================= */
app.set("trust proxy", 1);

module.exports = app;