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
  VABILO (invite) - preveri token
========================= */
router.get("/invite/:token", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT users.email, users.first_name, users.last_name, users.invite_token_expires_at,
              organizations.name AS organization_name
       FROM users
       LEFT JOIN organizations ON organizations.id = users.organization_id
       WHERE users.invite_token = ?`,
      [req.params.token]
    );

    const invite = rows[0];

    if (!invite) {
      return res.status(404).json({ message: "Povabilo ne obstaja" });
    }

    if (new Date(invite.invite_token_expires_at) < new Date()) {
      return res.status(400).json({ message: "Povabilo je poteklo" });
    }

    res.json({
      email: invite.email,
      first_name: invite.first_name,
      last_name: invite.last_name,
      organization_name: invite.organization_name
    });
  } catch (err) {
    console.error("GET INVITE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  VABILO (invite) - nastavi geslo in aktiviraj račun
========================= */
router.post("/invite/:token/activate", async (req, res) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ message: "Geslo mora imeti vsaj 6 znakov" });
    }

    const rows = await db.query(
      `SELECT users.*, organizations.name AS organization_name
       FROM users
       LEFT JOIN organizations ON organizations.id = users.organization_id
       WHERE users.invite_token = ?`,
      [req.params.token]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "Povabilo ne obstaja" });
    }

    if (new Date(user.invite_token_expires_at) < new Date()) {
      return res.status(400).json({ message: "Povabilo je poteklo" });
    }

    const password_hash = await bcrypt.hash(password, 10);

    await db.query(
      `UPDATE users
       SET password_hash = ?, invite_token = NULL, invite_token_expires_at = NULL
       WHERE id = ?`,
      [password_hash, user.id]
    );

    user.password_hash = password_hash;

    req.login(user, (err) => {
      if (err) {
        console.error("LOGIN ERROR:", err);
        return res.status(500).json({ message: "Login error" });
      }

      req.session.save((err) => {
        if (err) {
          console.error("SESSION SAVE ERROR:", err);
          return res.status(500).json({ message: "Session save error" });
        }

        res.json({ message: "Account activated", user: toPublicUser(user) });
      });
    });
  } catch (err) {
    console.error("ACTIVATE INVITE ERROR:", err);
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


module.exports = router;
