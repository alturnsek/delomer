const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/roles");
const { createInviteToken, sendInviteEmail, issueAndSendInvite } = require("../utils/invites");
const { serializeRow } = require("../utils/workLogs");

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

    res.json(rows.map(serializeRow));
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

    await sendInviteEmail(email, token);

    res.json({ message: "Društvo ustvarjeno, vabilo za admina poslano (glej strežniške loge za povezavo)" });
  } catch (err) {
    console.error("CREATE ORGANIZATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  UREDI DRUŠTVO
========================= */
router.put("/organizations/:id", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Vnesi ime društva" });
    }

    const result = await db.query(
      "UPDATE organizations SET name = ? WHERE id = ?",
      [name, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Društvo ni najdeno" });
    }

    res.json({ message: "Društvo posodobljeno" });
  } catch (err) {
    console.error("UPDATE ORGANIZATION ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  NASTAVITVE APLIKACIJE (npr. način pošiljanja emailov)
========================= */
router.get("/settings", async (req, res) => {
  try {
    const rows = await db.query("SELECT setting_key, setting_value FROM app_settings");
    res.json(Object.fromEntries(rows.map(r => [r.setting_key, r.setting_value])));
  } catch (err) {
    console.error("GET SETTINGS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/settings/email-mode", async (req, res) => {
  try {
    const { email_mode } = req.body;

    if (!["log", "real"].includes(email_mode)) {
      return res.status(400).json({ message: "Neveljaven način" });
    }

    await db.query(
      `INSERT INTO app_settings (setting_key, setting_value) VALUES ('email_mode', ?)
       ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
      [email_mode]
    );

    res.json({ message: "Nastavitev posodobljena" });
  } catch (err) {
    console.error("UPDATE EMAIL MODE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  ČLANI DOLOČENEGA DRUŠTVA (za upravljanje adminov)
========================= */
router.get("/organizations/:id/users", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, first_name, last_name, email, role, is_active, is_deleted,
              (password_hash != '') AS activated
       FROM users
       WHERE organization_id = ?
       ORDER BY role ASC, last_name ASC, first_name ASC`,
      [req.params.id]
    );

    res.json(rows);
  } catch (err) {
    console.error("LIST ORG USERS (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  UREDI PODATKE ČLANA V DRUŠTVU
========================= */
router.put("/organizations/:id/users/:userId", async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;

    if (!first_name || !last_name) {
      return res.status(400).json({ message: "Manjkajo podatki" });
    }

    const rows = await db.query(
      "SELECT id, password_hash, is_deleted FROM users WHERE id = ? AND organization_id = ?",
      [req.params.userId, req.params.id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    if (rows[0].is_deleted) {
      return res.status(400).json({ message: "Uporabnik je izbrisan" });
    }

    const cleanEmail = (email || "").trim().toLowerCase() || null;

    if (!cleanEmail && rows[0].password_hash) {
      return res.status(400).json({ message: "Email je obvezen za aktiviran račun" });
    }

    if (cleanEmail) {
      const emailTaken = await db.query(
        "SELECT id FROM users WHERE email = ? AND id != ?",
        [cleanEmail, req.params.userId]
      );

      if (emailTaken.length) {
        return res.status(400).json({ message: "Email je že uporabljen" });
      }
    }

    await db.query(
      "UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?",
      [first_name.trim(), last_name.trim(), cleanEmail, req.params.userId]
    );

    res.json({ message: "Posodobljeno" });
  } catch (err) {
    console.error("EDIT USER (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  PONOVNO POŠLJI VABILO (če član še ni aktiviral računa)
========================= */
router.post("/organizations/:id/users/:userId/resend-invite", async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT id, email, password_hash FROM users WHERE id = ? AND organization_id = ?",
      [req.params.userId, req.params.id]
    );

    const user = rows[0];

    if (!user) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    if (user.password_hash) {
      return res.status(400).json({ message: "Uporabnik je že aktiviral račun" });
    }

    if (!user.email) {
      return res.status(400).json({ message: "Član nima nastavljenega emaila" });
    }

    await issueAndSendInvite(user.id, user.email);

    res.json({ message: "Vabilo ponovno poslano (glej strežniške loge za povezavo)" });
  } catch (err) {
    console.error("RESEND INVITE (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  SPREMENI VLOGO ČLANA V DRUŠTVU (ADMIN / SUPERINTENDENT / MEMBER)
========================= */
router.post("/organizations/:id/users/:userId/role", async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ["ADMIN", "SUPERINTENDENT", "MEMBER", "PUBLIC"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Neveljavna vloga" });
    }

    const result = await db.query(
      "UPDATE users SET role = ? WHERE id = ? AND organization_id = ? AND is_deleted = 0",
      [role, req.params.userId, req.params.id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    res.json({ message: "Vloga posodobljena" });
  } catch (err) {
    console.error("CHANGE ROLE (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  MNOŽIČNA SPREMEMBA VLOGE (SUPER_ADMIN)
========================= */
router.post("/organizations/:id/users/bulk-role", async (req, res) => {
  try {
    const { user_ids, role } = req.body;
    const allowedRoles = ["ADMIN", "SUPERINTENDENT", "MEMBER", "PUBLIC"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Neveljavna vloga" });
    }

    if (!Array.isArray(user_ids) || !user_ids.length) {
      return res.status(400).json({ message: "Seznam uporabnikov je prazen" });
    }

    const results = [];

    for (const userId of user_ids) {
      const result = await db.query(
        "UPDATE users SET role = ? WHERE id = ? AND organization_id = ? AND is_deleted = 0",
        [role, userId, req.params.id]
      );

      results.push({
        user_id: userId,
        ok: !!result.affectedRows,
        message: result.affectedRows ? undefined : "Uporabnik ni najden ali je izbrisan"
      });
    }

    res.json({ results });
  } catch (err) {
    console.error("BULK CHANGE ROLE (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  IZBRIS ČLANA (SUPER_ADMIN) - hibridni pristop:
  brez povezanega dela = pravi izbris; z delom = anonimizacija (ohrani ure/statistiko)
========================= */
async function deleteOrgUser(organizationId, userId) {
  const rows = await db.query(
    "SELECT id, is_deleted FROM users WHERE id = ? AND organization_id = ?",
    [userId, organizationId]
  );

  const user = rows[0];

  if (!user) {
    return { user_id: userId, ok: false, message: "Uporabnik ni najden" };
  }

  if (user.is_deleted) {
    return { user_id: userId, ok: true };
  }

  const workRows = await db.query("SELECT id FROM work_logs WHERE user_id = ? LIMIT 1", [userId]);
  const participantRows = workRows.length
    ? []
    : await db.query("SELECT 1 FROM work_log_participants WHERE user_id = ? LIMIT 1", [userId]);

  if (workRows.length || participantRows.length) {
    await db.query(
      `UPDATE users
       SET first_name = 'Izbrisan', last_name = 'uporabnik', email = NULL, password_hash = '',
           avatar_path = NULL, invite_token = NULL, invite_token_expires_at = NULL,
           is_active = 0, is_deleted = 1
       WHERE id = ?`,
      [userId]
    );
  } else {
    await db.query("DELETE FROM users WHERE id = ?", [userId]);
  }

  return { user_id: userId, ok: true };
}

router.delete("/organizations/:id/users/:userId", async (req, res) => {
  try {
    const result = await deleteOrgUser(req.params.id, req.params.userId);

    if (!result.ok) {
      return res.status(404).json({ message: result.message });
    }

    res.json({ message: "Uporabnik izbrisan" });
  } catch (err) {
    console.error("DELETE USER (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/organizations/:id/users/bulk-delete", async (req, res) => {
  try {
    const { user_ids } = req.body;

    if (!Array.isArray(user_ids) || !user_ids.length) {
      return res.status(400).json({ message: "Seznam uporabnikov je prazen" });
    }

    const results = [];

    for (const userId of user_ids) {
      results.push(await deleteOrgUser(req.params.id, userId));
    }

    res.json({ results });
  } catch (err) {
    console.error("BULK DELETE USERS (SUPERADMIN) ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  STATISTIKA VSEH DRUŠTEV (skupaj + po društvih, filtri: obdobje/status/društva)
========================= */
router.get("/stats", async (req, res) => {
  try {
    const { from, to, statuses, organization_ids } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Manjkata from/to parametra" });
    }

    const conditions = ["DATE(work_logs.started_at) BETWEEN ? AND ?"];
    const params = [from, to];

    const statusList = (statuses || "").split(",").filter(Boolean);
    if (statusList.length) {
      conditions.push(`work_logs.status IN (${statusList.map(() => "?").join(",")})`);
      params.push(...statusList);
    }

    const orgIds = (organization_ids || "").split(",").map(Number).filter(Boolean);
    if (orgIds.length) {
      conditions.push(`work_logs.organization_id IN (${orgIds.map(() => "?").join(",")})`);
      params.push(...orgIds);
    }

    const whereClause = conditions.join(" AND ");

    const byDateRows = await db.query(
      `SELECT DATE(work_logs.started_at) AS work_date,
              SUM(COALESCE(work_log_participants.minutes_override, TIMESTAMPDIFF(MINUTE, work_logs.started_at, work_logs.ended_at))) AS minutes
       FROM work_logs
       JOIN work_log_participants ON work_log_participants.work_log_id = work_logs.id
       WHERE ${whereClause}
       GROUP BY DATE(work_logs.started_at)
       ORDER BY work_date ASC`,
      params
    );

    const byOrgRows = await db.query(
      `SELECT work_logs.organization_id, organizations.name,
              SUM(COALESCE(work_log_participants.minutes_override, TIMESTAMPDIFF(MINUTE, work_logs.started_at, work_logs.ended_at))) AS minutes
       FROM work_logs
       JOIN work_log_participants ON work_log_participants.work_log_id = work_logs.id
       JOIN organizations ON organizations.id = work_logs.organization_id
       WHERE ${whereClause}
       GROUP BY work_logs.organization_id, organizations.name
       ORDER BY minutes DESC`,
      params
    );

    const byDate = byDateRows.map(r => ({
      date: r.work_date instanceof Date ? r.work_date.toISOString().slice(0, 10) : r.work_date,
      minutes: Number(r.minutes)
    }));

    const byOrganization = byOrgRows.map(r => ({
      organization_id: Number(r.organization_id),
      name: r.name,
      minutes: Number(r.minutes)
    }));

    const totalMinutes = byOrganization.reduce((sum, o) => sum + o.minutes, 0);

    res.json({ byDate, byOrganization, totalMinutes });
  } catch (err) {
    console.error("GET PLATFORM STATS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
