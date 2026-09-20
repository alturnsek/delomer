const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const passport = require("passport");
require("dotenv").config();

const { apiLimiter } = require("./middleware/rateLimit");

// routes
const users = require("./routes/users");
const work = require("./routes/work");
const admin = require("./routes/admin");
const superadmin = require("./routes/superadmin");

//passport config
require("./config/passport");

const app = express();

/* =========================
  DEBUG
========================= */
app.use((req, res, next) => {
  console.log("COOKIE HEADER:", req.headers.cookie);
  next();
});

/* =========================
SECURITY
========================= */
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true
    }
  })
);
/* =========================
  CORS
========================= */
app.use(
  cors({
    origin: true, 
    credentials: true
  })
);

/* =========================
  PARSERJI
========================= */
app.use(express.json());

/* =========================
  SESSION
========================= */
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax"
    }
  })
);

/* =========================
  PASSPORT
========================= */
app.use(passport.initialize());
app.use(passport.session());

/* =========================
  LANDING STRAN (delomer.top / www.delomer.top) - ločena marketinška stran,
  aplikacija sama teče samo na app.delomer.top. Isti Nginx Proxy Manager
  cilj (isti kontejner/port), ločevanje glede na Host header.
========================= */
const LANDING_HOSTS = (process.env.LANDING_HOSTS || "delomer.top,www.delomer.top").split(",");
const landingStatic = express.static(path.join(__dirname, "landing"));

app.use((req, res, next) => {
  if (!LANDING_HOSTS.includes(req.hostname)) {
    return next();
  }

  // na tej domeni obstaja samo marketinška stran - nikoli ne pade skozi
  // na API/SPA route spodaj, tudi če zahtevana pot ne obstaja
  landingStatic(req, res, (err) => {
    if (err) return next(err);
    res.sendFile(path.join(__dirname, "landing", "index.html"));
  });
});

/* =========================
  STATIC FILES
========================= */
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));

/* =========================
  ROUTES
========================= */
app.use("/api", apiLimiter);
app.use("/api/users", users);
app.use("/api/work", work);
app.use("/api/admin", admin);
app.use("/api/superadmin", superadmin);

/* =========================
  AUTH CHECK
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
  HTML
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================
  HEALTH CHECK
========================= */
app.get("/health", (req, res) => {
  res.json({ status: "OK" });
});

/* =========================
  TRUST PROXY
========================= */
app.set("trust proxy", 1);

module.exports = app;