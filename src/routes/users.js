const express = require("express");
const bcrypt = require("bcrypt");
const db = require("../config/db");
const passport = require("passport");

const router = express.Router();

/* =========================
  HELPERS
========================= */
function toPublicUser(user) {
  return {
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    organization_id: user.organization_id,
    organization_name: user.organization_name,
    role: user.role
  };
}

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
        res.json({ message: "OK", user: toPublicUser(user) });
      });
    });
  })(req, res, next);
});


/* =========================
  ORGANIZACIJE (seznam za register step2 - pridružitev obstoječemu)
========================= */
router.get("/organizations", async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT id, name FROM organizations ORDER BY name ASC"
    );

    res.json(rows);
  } catch (err) {
    console.error("LIST ORGANIZATIONS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
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
    const { first_name, last_name, org_mode, org_name, organization_id } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ message: "Manjkajo podatki" });
    }

    if (!req.session.tmpUser) {
      return res.status(400).json({ message: "Session expired" });
    }

    if (org_mode !== "create" && org_mode !== "join") {
      return res.status(400).json({ message: "Izberi društvo" });
    }

    let resolvedOrgId;
    let role;

    if (org_mode === "create") {
      const name = (org_name || "").trim();

      if (!name) {
        return res.status(400).json({ message: "Vnesi ime društva" });
      }

      const orgResult = await db.query(
        "INSERT INTO organizations (name) VALUES (?)",
        [name]
      );

      resolvedOrgId = orgResult.insertId;
      role = "ADMIN";
    } else {
      const orgId = Number(organization_id);

      if (!orgId) {
        return res.status(400).json({ message: "Izberi društvo" });
      }

      const orgRows = await db.query(
        "SELECT id FROM organizations WHERE id = ?",
        [orgId]
      );

      if (!orgRows.length) {
        return res.status(400).json({ message: "Društvo ne obstaja" });
      }

      resolvedOrgId = orgId;
      role = "MEMBER";
    }

    const { email, password_hash } = req.session.tmpUser;

    // ✅ INSERT
    const insertResult = await db.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, organization_id, role)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, password_hash, first_name, last_name, resolvedOrgId, role]
    );

    const insertId = insertResult.insertId;

    //GET USER (z imenom društva)
    const rows = await db.query(
      `SELECT users.*, organizations.name AS organization_name
       FROM users
       LEFT JOIN organizations ON organizations.id = users.organization_id
       WHERE users.id = ?`,
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

        res.json({ message: "Registered", user: toPublicUser(user) });
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
    user: toPublicUser(req.user)
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
