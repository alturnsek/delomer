const express = require("express");
const bcrypt = require("bcrypt");
const path = require("path");
const fs = require("fs");
const db = require("../config/db");
const passport = require("passport");
const { requireAuth } = require("../middleware/roles");
const { uploadAvatar } = require("../middleware/upload");

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
    role: user.role,
    avatar_path: user.avatar_path || null
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
  SPREMENI GESLO
========================= */
router.post("/me/password", requireAuth, async (req, res) => {
  try {
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      return res.status(400).json({ message: "Izpolni vsa polja" });
    }

    const rows = await db.query("SELECT password_hash FROM users WHERE id = ?", [req.user.id]);
    const user = rows[0];

    const match = user?.password_hash && await bcrypt.compare(old_password, user.password_hash);

    if (!match) {
      return res.status(400).json({ message: "Napačno trenutno geslo" });
    }

    const password_hash = await bcrypt.hash(new_password, 10);

    await db.query("UPDATE users SET password_hash = ? WHERE id = ?", [password_hash, req.user.id]);

    res.json({ message: "Geslo posodobljeno" });
  } catch (err) {
    console.error("CHANGE PASSWORD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  SPREMENI EMAIL
========================= */
router.put("/me/email", requireAuth, async (req, res) => {
  try {
    const email = (req.body.email || "").trim().toLowerCase();

    if (!email) {
      return res.status(400).json({ message: "Vnesi email" });
    }

    const existing = await db.query("SELECT id FROM users WHERE email = ? AND id != ?", [email, req.user.id]);

    if (existing.length) {
      return res.status(400).json({ message: "Email je že uporabljen" });
    }

    await db.query("UPDATE users SET email = ? WHERE id = ?", [email, req.user.id]);

    res.json({ message: "Email posodobljen" });
  } catch (err) {
    console.error("CHANGE EMAIL ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  PROFILNA SLIKA
========================= */
router.post("/me/avatar", requireAuth, (req, res, next) => {
  uploadAvatar.single("avatar")(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || "Napaka pri nalaganju datoteke" });
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Manjka datoteka" });
    }

    const relativePath = `/uploads/avatars/${req.file.filename}`;

    const rows = await db.query("SELECT avatar_path FROM users WHERE id = ?", [req.user.id]);
    const oldPath = rows[0]?.avatar_path;

    await db.query("UPDATE users SET avatar_path = ? WHERE id = ?", [relativePath, req.user.id]);

    if (oldPath) {
      fs.unlink(path.join(__dirname, "..", "..", oldPath), () => {});
    }

    res.json({ message: "Slika naložena", avatar_path: relativePath });
  } catch (err) {
    console.error("AVATAR UPLOAD ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  STATISTIKA DELA (za "Moj profil")
========================= */
router.get("/me/stats", requireAuth, async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Manjkata from/to parametra" });
    }

    const rows = await db.query(
      `SELECT DATE(work_logs.started_at) AS work_date,
              SUM(COALESCE(work_log_participants.minutes_override,
                           TIMESTAMPDIFF(MINUTE, work_logs.started_at, work_logs.ended_at))) AS minutes
       FROM work_logs
       JOIN work_log_participants ON work_log_participants.work_log_id = work_logs.id
       WHERE work_log_participants.user_id = ?
         AND work_logs.status = 'APPROVED'
         AND DATE(work_logs.started_at) BETWEEN ? AND ?
       GROUP BY DATE(work_logs.started_at)
       ORDER BY work_date ASC`,
      [req.user.id, from, to]
    );

    res.json(rows.map(r => ({
      date: r.work_date instanceof Date ? r.work_date.toISOString().slice(0, 10) : r.work_date,
      minutes: Number(r.minutes)
    })));
  } catch (err) {
    console.error("GET STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
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
