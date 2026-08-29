const express = require("express");
const db = require("../config/db");
const { requireRole } = require("../middleware/roles");
const { createInviteToken, logInviteEmail } = require("../utils/invites");
const { serializeRow, attachParticipants, resolveOrgParticipants, saveParticipants } = require("../utils/workLogs");

const router = express.Router();

// ADMIN in SUPERINTENDENT imata enake operativne pravice (delo, kategorije,
// potrjevanje); upravljanje uporabnikov je omejeno samo na ADMIN-a spodaj.
const canManageWork = requireRole("ADMIN", "SUPERINTENDENT");
const canManageUsers = requireRole("ADMIN");

router.use(canManageWork);

/* =========================
  ČLANI DRUŠTVA (branje - ADMIN in SUPERINTENDENT, upravljanje samo ADMIN)
========================= */
router.get("/users", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, first_name, last_name, email, role, is_active,
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

/* =========================
  PROFIL ENEGA ČLANA (za ogled iz seznama)
========================= */
router.get("/users/:id", async (req, res) => {
  try {
    const rows = await db.query(
      `SELECT id, first_name, last_name, email, role, avatar_path, is_active,
              (password_hash != '') AS activated
       FROM users
       WHERE id = ? AND organization_id = ?`,
      [req.params.id, req.user.organization_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    res.json(serializeRow(rows[0]));
  } catch (err) {
    console.error("GET USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/users/:id/stats", async (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ message: "Manjkata from/to parametra" });
    }

    const userCheck = await db.query(
      "SELECT id FROM users WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    if (!userCheck.length) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
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
      [req.params.id, from, to]
    );

    res.json(rows.map(r => ({
      date: r.work_date instanceof Date ? r.work_date.toISOString().slice(0, 10) : r.work_date,
      minutes: Number(r.minutes)
    })));
  } catch (err) {
    console.error("GET USER STATS ERROR:", err);
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
router.post("/users", canManageUsers, async (req, res) => {
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
router.post("/users/bulk", canManageUsers, async (req, res) => {
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
  UREDI PODATKE ČLANA
========================= */
router.put("/users/:id", canManageUsers, async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;

    if (!first_name || !last_name || !email) {
      return res.status(400).json({ message: "Manjkajo podatki" });
    }

    const cleanEmail = email.trim().toLowerCase();

    const rows = await db.query(
      "SELECT id FROM users WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    if (!rows.length) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    const emailTaken = await db.query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [cleanEmail, req.params.id]
    );

    if (emailTaken.length) {
      return res.status(400).json({ message: "Email je že uporabljen" });
    }

    await db.query(
      "UPDATE users SET first_name = ?, last_name = ?, email = ? WHERE id = ?",
      [first_name.trim(), last_name.trim(), cleanEmail, req.params.id]
    );

    res.json({ message: "Posodobljeno" });
  } catch (err) {
    console.error("EDIT USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  SPREMENI VLOGO ČLANA (ADMIN / SUPERINTENDENT / MEMBER)
========================= */
router.post("/users/:id/role", canManageUsers, async (req, res) => {
  try {
    const { role } = req.body;
    const allowedRoles = ["ADMIN", "SUPERINTENDENT", "MEMBER"];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Neveljavna vloga" });
    }

    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: "Svoje vloge ne moreš spremeniti" });
    }

    const result = await db.query(
      "UPDATE users SET role = ? WHERE id = ? AND organization_id = ?",
      [role, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    res.json({ message: "Vloga posodobljena" });
  } catch (err) {
    console.error("CHANGE ROLE ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  (DE)AKTIVACIJA ČLANA
========================= */
router.post("/users/:id/deactivate", canManageUsers, async (req, res) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ message: "Svojega računa ne moreš deaktivirati" });
    }

    const result = await db.query(
      "UPDATE users SET is_active = 0 WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    res.json({ message: "Uporabnik deaktiviran" });
  } catch (err) {
    console.error("DEACTIVATE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/users/:id/activate", canManageUsers, async (req, res) => {
  try {
    const result = await db.query(
      "UPDATE users SET is_active = 1 WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Uporabnik ni najden" });
    }

    res.json({ message: "Uporabnik aktiviran" });
  } catch (err) {
    console.error("ACTIVATE USER ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* =========================
  KATEGORIJE DELA
  (branje samo aktivnih za dropdown ob vnosu dela je na GET /api/work/categories;
   tu je branje VSEH - vključno z neaktivnimi - za upravljanje)
========================= */
router.get("/categories", async (req, res) => {
  try {
    const rows = await db.query(
      "SELECT id, name, is_active FROM work_categories WHERE organization_id = ? ORDER BY name ASC",
      [req.user.organization_id]
    );

    res.json(rows.map(serializeRow));
  } catch (err) {
    console.error("LIST CATEGORIES ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

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

router.put("/categories/:id", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Vnesi ime kategorije" });
    }

    const result = await db.query(
      "UPDATE work_categories SET name = ? WHERE id = ? AND organization_id = ?",
      [name, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Kategorija ni najdena" });
    }

    res.json({ message: "Kategorija preimenovana" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Kategorija s tem imenom že obstaja" });
    }

    console.error("RENAME CATEGORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/categories/:id/deactivate", async (req, res) => {
  try {
    await db.query(
      "UPDATE work_categories SET is_active = 0 WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    res.json({ message: "Kategorija deaktivirana" });
  } catch (err) {
    console.error("DEACTIVATE CATEGORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.post("/categories/:id/activate", async (req, res) => {
  try {
    await db.query(
      "UPDATE work_categories SET is_active = 1 WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    res.json({ message: "Kategorija aktivirana" });
  } catch (err) {
    console.error("ACTIVATE CATEGORY ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* =========================
  EKIPE
========================= */
router.get("/teams", async (req, res) => {
  try {
    const teams = await db.query(
      "SELECT id, name FROM teams WHERE organization_id = ? ORDER BY name ASC",
      [req.user.organization_id]
    );

    if (!teams.length) return res.json([]);

    const ids = teams.map(t => t.id);
    const placeholders = ids.map(() => "?").join(",");

    const memberRows = await db.query(
      `SELECT team_id, user_id FROM team_members WHERE team_id IN (${placeholders})`,
      ids
    );

    const membersByTeam = {};
    memberRows.forEach(r => {
      const key = Number(r.team_id);
      if (!membersByTeam[key]) membersByTeam[key] = [];
      membersByTeam[key].push(Number(r.user_id));
    });

    res.json(teams.map(t => ({
      id: Number(t.id),
      name: t.name,
      member_ids: membersByTeam[Number(t.id)] || []
    })));
  } catch (err) {
    console.error("LIST TEAMS ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

async function setTeamMembers(organizationId, teamId, memberIds) {
  const numericIds = Array.isArray(memberIds) ? memberIds.map(Number).filter(Boolean) : [];

  await db.query("DELETE FROM team_members WHERE team_id = ?", [teamId]);

  if (!numericIds.length) return;

  const placeholders = numericIds.map(() => "?").join(",");

  const validRows = await db.query(
    `SELECT id FROM users WHERE id IN (${placeholders}) AND organization_id = ?`,
    [...numericIds, organizationId]
  );

  for (const row of validRows) {
    await db.query(
      "INSERT IGNORE INTO team_members (team_id, user_id) VALUES (?, ?)",
      [teamId, row.id]
    );
  }
}

router.post("/teams", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Vnesi ime ekipe" });
    }

    const result = await db.query(
      "INSERT INTO teams (organization_id, name) VALUES (?, ?)",
      [req.user.organization_id, name]
    );

    await setTeamMembers(req.user.organization_id, result.insertId, req.body.member_ids);

    res.json({ message: "Ekipa ustvarjena" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Ekipa s tem imenom že obstaja" });
    }

    console.error("CREATE TEAM ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.put("/teams/:id", async (req, res) => {
  try {
    const name = (req.body.name || "").trim();

    if (!name) {
      return res.status(400).json({ message: "Vnesi ime ekipe" });
    }

    const result = await db.query(
      "UPDATE teams SET name = ? WHERE id = ? AND organization_id = ?",
      [name, req.params.id, req.user.organization_id]
    );

    if (!result.affectedRows) {
      return res.status(404).json({ message: "Ekipa ni najdena" });
    }

    await setTeamMembers(req.user.organization_id, req.params.id, req.body.member_ids);

    res.json({ message: "Ekipa posodobljena" });
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(400).json({ message: "Ekipa s tem imenom že obstaja" });
    }

    console.error("UPDATE TEAM ERROR:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.delete("/teams/:id", async (req, res) => {
  try {
    await db.query(
      "DELETE FROM teams WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    res.json({ message: "Ekipa izbrisana" });
  } catch (err) {
    console.error("DELETE TEAM ERROR:", err);
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
    const { task, started_at, ended_at, category_id, participants } = req.body;

    const rows = await db.query(
      "SELECT id, user_id FROM work_logs WHERE id = ? AND organization_id = ?",
      [req.params.id, req.user.organization_id]
    );

    const workLog = rows[0];

    if (!workLog) {
      return res.status(404).json({ message: "Ni najdeno" });
    }

    await db.query(
      `UPDATE work_logs SET task = ?, started_at = ?, ended_at = ?, category_id = ?
       WHERE id = ?`,
      [task, started_at, ended_at, category_id || null, req.params.id]
    );

    if (Array.isArray(participants)) {
      await db.query("DELETE FROM work_log_participants WHERE work_log_id = ?", [req.params.id]);

      const participantsMap = await resolveOrgParticipants(db, req.user.organization_id, participants);
      if (!participantsMap.has(workLog.user_id)) participantsMap.set(workLog.user_id, null);

      await saveParticipants(db, req.params.id, participantsMap);
    }

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
