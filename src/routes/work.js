const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/roles');
const { serializeRow, attachParticipants, resolveOrgParticipants, saveParticipants } = require('../utils/workLogs');

const router = express.Router();

//uporabi za vse route
router.use(requireAuth);


/* =========================
  NASTAVITVE PRIKAZA/OBRAČUNAVANJA UR (za vse člane društva)
========================= */
router.get('/organization-settings', async (req, res) => {
  try {
    if (!req.user.organization_id) {
      return res.json({ hour_rounding_minutes: 1, hour_display_format: 'DECIMAL' });
    }

    const rows = await pool.query(
      "SELECT hour_rounding_minutes, hour_display_format FROM organizations WHERE id = ?",
      [req.user.organization_id]
    );

    res.json(rows[0] ? serializeRow(rows[0]) : { hour_rounding_minutes: 1, hour_display_format: 'DECIMAL' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* =========================
  KATEGORIJE (za dropdown ob vnosu dela - samo aktivne)
========================= */
router.get('/categories', async (req, res) => {
  try {
    if (!req.user.organization_id) return res.json([]);

    const rows = await pool.query(
      "SELECT id, name FROM work_categories WHERE organization_id = ? AND is_active = 1 ORDER BY name ASC",
      [req.user.organization_id]
    );

    res.json(rows.map(serializeRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* =========================
  ČLANI DRUŠTVA (za izbiro udeležencev skupinskega vnosa)
========================= */
router.get('/organization-members', async (req, res) => {
  try {
    if (!req.user.organization_id) return res.json([]);

    const rows = await pool.query(
      `SELECT id, first_name, last_name FROM users
       WHERE organization_id = ? AND id != ? AND is_active = 1 AND role != 'PUBLIC'
       ORDER BY first_name ASC, last_name ASC`,
      [req.user.organization_id, req.user.id]
    );

    res.json(rows.map(serializeRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* =========================
  EKIPE (za hitro dodajanje več udeležencev naenkrat)
========================= */
router.get('/teams', async (req, res) => {
  try {
    if (!req.user.organization_id) return res.json([]);

    const teams = await pool.query(
      "SELECT id, name FROM teams WHERE organization_id = ? ORDER BY name ASC",
      [req.user.organization_id]
    );

    if (!teams.length) return res.json([]);

    const ids = teams.map(t => t.id);
    const placeholders = ids.map(() => "?").join(",");

    const memberRows = await pool.query(
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
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* =========================
  ADD WORK
========================= */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    if (!req.user.is_active) {
      return res.status(403).json({ error: "Vaš račun je deaktiviran, ne morete dodajati dela" });
    }

    const { task, started_at, ended_at, category_id, participants } = req.body;

    if (!task) {
      return res.status(400).json({ error: "Task is required" });
    }

    if (!ended_at) {
      return res.status(400).json({ error: "End time required" });
    }

    const startTime = started_at ? new Date(started_at) : new Date();
    const endTime = new Date(ended_at);

    if (endTime < startTime) {
      return res.status(400).json({ error: "End must be after start" });
    }

    const insertResult = await conn.query(
      `INSERT INTO work_logs (user_id, organization_id, category_id, task, started_at, ended_at, status, pending_since)
       VALUES (?, ?, ?, ?, ?, ?, 'PENDING', NOW())`,
      [req.user.id, req.user.organization_id, category_id || null, task, startTime, endTime]
    );

    const workLogId = insertResult.insertId;

    const participantsMap = await resolveOrgParticipants(conn, req.user.organization_id, participants);
    // javni (kiosk) račun ni oseba, ki opravlja delo - se sam ne doda kot sodelavec
    if (req.user.role !== "PUBLIC" && !participantsMap.has(req.user.id)) {
      participantsMap.set(req.user.id, null);
    }

    await saveParticipants(conn, workLogId, participantsMap);

    res.json({ message: 'Work added' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    conn.release();
  }
});


/* =========================
  GET USER WORK (kjer je uporabnik ustvarjatelj ali udeleženec)
========================= */
router.get('/', async (req, res) => {
  try {
    const rows = await pool.query(
      `SELECT DISTINCT work_logs.id, work_logs.task, work_logs.started_at, work_logs.ended_at,
              work_logs.status, work_logs.rejection_reason, work_logs.is_auto_approved,
              work_logs.user_id, work_logs.category_id,
              work_categories.name AS category_name,
              TIMESTAMPDIFF(MINUTE, work_logs.started_at, work_logs.ended_at) AS minutes
       FROM work_logs
       LEFT JOIN work_categories ON work_categories.id = work_logs.category_id
       LEFT JOIN work_log_participants ON work_log_participants.work_log_id = work_logs.id
       WHERE work_logs.user_id = ? OR work_log_participants.user_id = ?
       ORDER BY work_logs.started_at DESC`,
      [req.user.id, req.user.id]
    );

    const withParticipants = await attachParticipants(pool, rows.map(serializeRow));

    res.json(withParticipants);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* =========================
  DELETE WORK
========================= */
router.delete('/:id', async (req, res) => {
  try {
    const rows = await pool.query(
      "SELECT user_id, status FROM work_logs WHERE id = ?",
      [req.params.id]
    );

    const workLog = rows[0];

    if (!workLog) {
      return res.status(404).json({ error: "Not found" });
    }

    if (workLog.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (workLog.status === "APPROVED") {
      return res.status(400).json({ error: "Potrjenega vnosa ni mogoče izbrisati" });
    }

    await pool.query(
      "DELETE FROM work_logs WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );

    res.json({ message: "Deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
  UPDATE WORK (samo ustvarjatelj, samo dokler ni APPROVED)
========================= */
router.put('/:id', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { task, started_at, ended_at, category_id, participants } = req.body;

    const rows = await conn.query(
      "SELECT * FROM work_logs WHERE id = ?",
      [req.params.id]
    );

    const workLog = rows[0];

    if (!workLog) {
      return res.status(404).json({ error: "Not found" });
    }

    if (workLog.user_id !== req.user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }

    if (workLog.status === "APPROVED") {
      return res.status(400).json({ error: "Potrjenega vnosa ni mogoče urejati" });
    }

    const wasRejected = workLog.status === "REJECTED";

    // rejection_reason NAMENOMA ostane po ponovni oddaji (zgodovina) - frontend
    // ga uporabi za oznako "popravljeno po zavrnitvi", dokler je status PENDING.
    await conn.query(
      `UPDATE work_logs
       SET task = ?, started_at = ?, ended_at = ?, category_id = ?
           ${wasRejected ? ", status = 'PENDING', pending_since = NOW()" : ""}
       WHERE id = ?`,
      [task, started_at, ended_at, category_id || null, req.params.id]
    );

    if (Array.isArray(participants)) {
      await conn.query("DELETE FROM work_log_participants WHERE work_log_id = ?", [req.params.id]);

      const participantsMap = await resolveOrgParticipants(conn, req.user.organization_id, participants);
      if (req.user.role !== "PUBLIC" && !participantsMap.has(req.user.id)) {
        participantsMap.set(req.user.id, null);
      }

      await saveParticipants(conn, req.params.id, participantsMap);
    }

    res.json({ message: "Updated" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  } finally {
    conn.release();
  }
});


module.exports = router;
