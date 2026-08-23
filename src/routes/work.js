const express = require('express');
const pool = require('../config/db');

const router = express.Router();

/* =========================
  SESSION AUTH MIDDLEWARE
========================= */
function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

//uporabi za vse route
router.use(requireAuth);


/* =========================
  ADD WORK
========================= */
router.post('/', async (req, res) => {
  try {
    const { task, started_at, ended_at } = req.body;

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

    const conn = await pool.getConnection();

    await conn.query(
      `INSERT INTO work_logs (user_id, task, started_at, ended_at)
       VALUES (?, ?, ?, ?)`,
      [req.user.id, task, startTime, endTime]
    );

    conn.release();

    res.json({ message: 'Work added' });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


/* =========================
  GET USER WORK
========================= */
router.get('/', async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT 
          id,
          task,
          started_at,
          ended_at,
          TIMESTAMPDIFF(MINUTE, started_at, ended_at) AS minutes
       FROM work_logs
       WHERE user_id = ?
       ORDER BY started_at DESC`,
      [req.user.id]
    );

    conn.release();

    const safeRows = rows.map(row => {
      return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
          key,
          typeof value === 'bigint' ? Number(value) : value
        ])
      );
    });

    res.json(safeRows);

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
    const conn = await pool.getConnection();

    await conn.query(
      "DELETE FROM work_logs WHERE id = ? AND user_id = ?",
      [req.params.id, req.user.id]
    );

    conn.release();

    res.json({ message: "Deleted" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =========================
  UPDATE WORK
========================= */
router.put('/:id', async (req, res) => {
  try {
    const { task, started_at, ended_at } = req.body;

    const conn = await pool.getConnection();

    await conn.query(
      `UPDATE work_logs 
       SET task = ?, started_at = ?, ended_at = ?
       WHERE id = ? AND user_id = ?`,
      [task, started_at, ended_at, req.params.id, req.user.id]
    );

    conn.release();

    res.json({ message: "Updated" });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});


module.exports = router;
