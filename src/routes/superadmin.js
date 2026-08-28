const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/roles");
const { createInviteToken, logInviteEmail } = require("../utils/invites");

const router = express.Router();

// vse route v tem routerju so samo za SUPER_ADMIN-a
router.use(requireRole("SUPER_ADMIN"));

/* =========================
  SEZNAM DRUŠTEV
========================= */
router.get("/organizations", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT organizations.id, organizations.name, organizations.created_at,
              COUNT(users.id) AS member_count
       FROM organizations
       LEFT JOIN users ON users.organization_id = organizations.id
       GROUP BY organizations.id
       ORDER BY organizations.name ASC`
    );

    res.json(rows);
  } catch (err) {
    console.error("LIST ORGANIZATIONS (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  USTVARI DRUŠTVO + POVABI PRVEGA ADMINA
========================= */
router.post("/organizations", async (req, res) => {
  try {
    const { name, admin_first_name, admin_last_name, admin_email } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Vnesi ime društva" });
    }

    if (!admin_first_name || !admin_last_name || !admin_email) {
      return res.status(400).json({ message: "Manjkajo podatki za admina društva" });
    }

    const email = admin_email.trim().toLowerCase();

    const existing = await db.query("SELECT id FROM users WHERE email = ?", [email]);

    if (existing.length > 0) {
      return res.status(400).json({ message: "Email je že uporabljen" });
    }

    const orgResult = await db.query(
      "INSERT INTO organizations (name) VALUES (?)",
      [name.trim()]
    );

    const organizationId = orgResult.insertId;

    const { token, expiresAt } = createInviteToken();

    await db.query(
      `INSERT INTO users (email, first_name, last_name, organization_id, role, invite_token, invite_token_expires_at)
       VALUES (?, ?, ?, ?, 'ADMIN', ?, ?)`,
      [email, admin_first_name.trim(), admin_last_name.trim(), organizationId, token, expiresAt]
    );

    logInviteEmail(email, token);

    res.json({ message: "Društvo ustvarjeno, vabilo za admina poslano (glej strežniške loge za povezavo)" });
  } catch (err) {
    console.error("CREATE ORGANIZATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
