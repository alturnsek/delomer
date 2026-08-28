const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/roles");
const { createInviteToken, logInviteEmail } = require("../utils/invites");
const { serializeRow, attachParticipants } = require("../utils/workLogs");

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

/* =========================
  KATEGORIJE DELA (branje za vse je na GET /api/work/categories)
========================= */
router.post("/categories", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Vnesi ime kategorije" });
    }

    await db.query(
      "INSERT INTO work_categories (organization_id, name) VALUES (?, ?)",
      [req.user.organization_id, name]
    );

    res.json({ message: "Kategorija dodana" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Kategorija že obstaja" });
    }

    console.error("CREATE CATEGORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/categories/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM work_categories WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    res.json({ message: "Kategorija izbrisana" });
  } catch (err) {
    console.error("DELETE CATEGORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  DELO V DRUŠTVU (vsi vnosi vseh članov)
========================= */
router.get("/work", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT work_logs.id, work_logs.task, work_logs.started_at, work_logs.ended_at,
              work_logs.status, work_logs.rejection_reason, work_logs.is_auto_approved,
              work_logs.user_id, work_logs.category_id,
              work_categories.name AS category_name,
              users.first_name AS creator_first_name, users.last_name AS creator_last_name,
              TIMESTAMPDIFF(MINUTE, work_logs.started_at, work_logs.ended_at) AS minutes
       FROM work_logs
       JOIN users ON users.id = work_logs.user_id
       LEFT JOIN work_categories ON work_categories.id = work_logs.category_id
       WHERE work_logs.organization_id = ?
       ORDER BY (work_logs.status = 'PENDING') DESC, work_logs.started_at DESC`,
      [req.user.organization_id]
    );

    const withParticipants = await attachParticipants(db, rows.map(serializeRow));

    res.json(withParticipants);
  } catch (err) {
    console.error("LIST ORG WORK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/work/:id", async (req, res) => {
  try {
    const { task, started_at, ended_at, category_id } = req.body;

    const rows = await db.query(
      "SELECT id FROM work_logs WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Ni najdeno" });
    }

    await db.query(
      `UPDATE work_logs SET task = ?, started_at = ?, ended_at = ?, category_id = ?
       WHERE id = ?`,
      [task, started_at, ended_at, category_id || null, req.params.id]
    );

    res.json({ message: "Posodobljeno" });
  } catch (err) {
    console.error("ADMIN EDIT WORK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/work/:id/approve", async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE work_logs SET status = 'APPROVED', reviewed_by = ?, reviewed_at = NOW()
       WHERE id = ? AND organization_id = ?`,
      [req.user.id, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ni najdeno" });
    }

    res.json({ message: "Potrjeno" });
  } catch (err) {
    console.error("APPROVE WORK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/work/:id/reject", async (req, res) => {
  try {
    const reason = (req.body.reason || "").trim();

    if (!reason) {
      return res.status(400).json({ message: "Razlog je obvezen" });
    }

    const result = await db.query(
      `UPDATE work_logs SET status = 'REJECTED', reviewed_by = ?, reviewed_at = NOW(), rejection_reason = ?
       WHERE id = ? AND organization_id = ?`,
      [req.user.id, reason, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ni najdeno" });
    }

    res.json({ message: "Zavrnjeno" });
  } catch (err) {
    console.error("REJECT WORK ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
