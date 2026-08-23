const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const passport = require("passport");

const router = express.Router();

/* =========================
  LOGIN
========================= */
router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user) => {
    if (err) return next(err);
    if (!user) return res.status(400).json({ message: "Napačen email ali geslo" });

    req.login(user, (err) => {
      if (err) return next(err);

      // ✅ session commit
      req.session.save(() => {
        res.json({ message: "OK", user });
      });
    });
  })(req, res, next);
});


/* =========================
  REGISTER STEP 1
========================= */
router.post("/register/step1", async (req, res) => {
  try {
    let { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Manjkajo podatki" });
    }

    email = email.trim().toLowerCase();

    const rows = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    if (rows.length > 0) {
      return res.status(400).json({ message: "Email že obstaja" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    req.session.tmpUser = {
      email,
      password_hash
    };

    res.json({ message: "OK" });

  } catch (err) {
    console.error("STEP1 ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  REGISTER STEP 2
========================= */
router.post("/register/step2", async (req, res) => {
  try {
    const { first_name, last_name } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ message: "Manjkajo podatki" });
    }

    if (!req.session.tmpUser) {
      return res.status(400).json({ message: "Session expired" });
    }

    const { email, password_hash } = req.session.tmpUser;

    // ✅ INSERT
    const insertResult = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name)
       VALUES (?, ?, ?, ?)`,
      [email, password_hash, first_name, last_name]
    );

    const insertId = insertResult.insertId;

    //GET USER
    const rows = await db.query(
      "SELECT * FROM users WHERE id = ?",
      [insertId]
    );

    const user = rows[0];

    if (!user) {
      return res.status(500).json({ message: "User fetch failed" });
    }

    //LOGIN
    req.login(user, (err) => {
      if (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ message: "Login error" });
      }

      //cleanup
      req.session.tmpUser = null;

      //session commit
      req.session.save((err) => {
        if (err) {
          console.error("SESSION SAVE ERROR:", err);
          return res.status(500).json({ message: "Session save error" });
        }

        res.json({ message: "Registered", user });
      });
    });

  } catch (err) {
    console.error("STEP2 ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  GOOGLE AUTH - to ne dela
========================= */
router.get("/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"]
  })
);

router.get("/auth/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/"
  }),
  (req, res) => {
    res.redirect("/");
  }
);


/* =========================
  CURRENT USER
========================= */
router.get("/me", (req, res) => {
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
  LOGOUT
========================= */
router.post("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });
});


/* =========================
  CHECK EMAIL
========================= */
router.post("/check-email", async (req, res) => {
  try {
    let { email } = req.body;

    if (!email) {
      return res.json({ exists: false });
    }

    email = email.trim().toLowerCase();

    const rows = await db.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );

    res.json({ exists: rows.length > 0 });

  } catch (err) {
    console.error("CHECK EMAIL ERROR:", err);
    res.status(500).json({ exists: false });
  }
});


module.exports = router;
