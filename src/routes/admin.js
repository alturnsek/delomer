const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/roles");
const { createInviteToken, logInviteEmail } = require("../utils/invites");

const router = express.Router();

// vse route v tem routerju so samo za ADMIN-a lastnega društva
router.use(requireRole("ADMIN"));

/* =========================
  ČLANI DRUŠTVA
========================= */
router.get("/users", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, first_name, last_name, email, role,
              (password_hash != '') AS activated
       FROM users
       WHERE organization_id = ?
       ORDER BY last_name ASC, first_name ASC`,
      [req.user.organization_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("LIST ORG USERS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

async function inviteOne(organizationId, entry) {
  const email = (entry.email || "").trim().toLowerCase();
  const first_name = (entry.first_name || "").trim();
  const last_name = (entry.last_name || "").trim();

  if (!email || !first_name || !last_name) {
    return { email: entry.email || "", ok: false, message: "Manjkajo podatki" };
  }

  const existing = await db.query("SELECT id FROM users WHERE email = ?", [email]);

  if (existing.length > 0) {
    return { email, ok: false, message: "Email je že uporabljen" };
  }

  const { token, expiresAt } = createInviteToken();

  await db.query(
    `INSERT INTO users (email, first_name, last_name, organization_id, role, invite_token, invite_token_expires_at)
     VALUES (?, ?, ?, ?, 'MEMBER', ?, ?)`,
    [email, first_name, last_name, organizationId, token, expiresAt]
  );

  logInviteEmail(email, token);

  return { email, ok: true };
}

/* =========================
  POVABI ENEGA ČLANA
========================= */
router.post("/users", async (req, res) => {
  try {
    const result = await inviteOne(req.user.organization_id, req.body);

    if (!result.ok) {
      return res.status(400).json({ message: result.message });
    }

    res.json({ message: "Vabilo poslano (glej strežniške loge za povezavo)" });
  } catch (err) {
    console.error("INVITE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  POVABI VEČ ČLANOV NAENKRAT
========================= */
router.post("/users/bulk", async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || !users.length) {
      return res.status(400).json({ message: "Seznam uporabnikov je prazen" });
    }

    const results = [];

    for (const entry of users) {
      results.push(await inviteOne(req.user.organization_id, entry));
    }

    res.json({ results });
  } catch (err) {
    console.error("BULK INVITE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
