const express = require('express');
const pool = require('../config/db');
const { requireAuth } = require('../middleware/roles');
const { serializeRow, attachParticipants, toNumber } = require('../utils/workLogs');

const router = express.Router();

//uporabi za vse route
router.use(requireAuth);


/* =========================
  KATEGORIJE (za dropdown ob vnosu dela)
========================= */
router.get('/categories', async (req, res) => {
  try {
    if (!req.user.organization_id) return res.json([]);

    const rows = await pool.query(
      "SELECT id, name FROM work_categories WHERE organization_id = ? ORDER BY name ASC",
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
       WHERE organization_id = ? AND id != ?
       ORDER BY first_name ASC, last_name ASC`,
      [req.user.organization_id, req.user.id]
    );

    res.json(rows.map(serializeRow));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// preveri, da udeleženci pripadajo istemu društvu kot prijavljeni uporabnik
async function resolveParticipantIds(conn, organizationId, creatorId, rawIds) {
  const participantIds = new Set([creatorId]);

  const numericIds = Array.isArray(rawIds)
    ? rawIds.map(Number).filter(Boolean)
    : [];

  if (numericIds.length && organizationId) {
    const placeholders = numericIds.map(() => '?').join(',');

    const validRows = await conn.query(
      `SELECT id FROM users WHERE id IN (${placeholders}) AND organization_id = ?`,
      [...numericIds, organizationId]
    );

    validRows.forEach(r => participantIds.add(toNumber(r.id)));
  }

  return participantIds;
}

async function saveParticipants(conn, workLogId, participantIds) {
  for (const participantId of participantIds) {
    await conn.query(
      "INSERT IGNORE INTO work_log_participants (work_log_id, user_id) VALUES (?, ?)",
      [workLogId, participantId]
    );
  }
}


/* =========================
  ADD WORK
========================= */
router.post('/', async (req, res) => {
  const conn = await pool.getConnection();

  try {
    const { task, started_at, ended_at, category_id, participant_ids } = req.body;

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

    const participantIds = await resolveParticipantIds(
      conn, req.user.organization_id, req.user.id, participant_ids
    );

    await saveParticipants(conn, workLogId, participantIds);

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
    const { task, started_at, ended_at, category_id, participant_ids } = req.body;

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

    await conn.query(
      `UPDATE work_logs
       SET task = ?, started_at = ?, ended_at = ?, category_id = ?
           ${wasRejected ? ", status = 'PENDING', pending_since = NOW(), reviewed_by = NULL, reviewed_at = NULL, rejection_reason = NULL" : ""}
       WHERE id = ?`,
      [task, started_at, ended_at, category_id || null, req.params.id]
    );

    if (Array.isArray(participant_ids)) {
      await conn.query("DELETE FROM work_log_participants WHERE work_log_id = ?", [req.params.id]);

      const participantIds = await resolveParticipantIds(
        conn, req.user.organization_id, req.user.id, participant_ids
      );

      await saveParticipants(conn, req.params.id, participantIds);
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
