const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// ✅ ADD WORK
router.post('/', auth, async (req, res) => {
  try {
    const { task, started_at, ended_at } = req.body;

    // basic validation
    if (!ended_at) {
      return res.status(400).json({ error: "End time required" });
    }

    // default start time = now
    const startTime = started_at ? new Date(started_at) : new Date();
    const endTime = new Date(ended_at);

    if (endTime < startTime) {
      return res.status(400).json({ error: "End must be after start" });
    }

    const conn = await pool.getConnection();

    await conn.query(
      `INSERT INTO work_log (user_id, task, started_at, ended_at)
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


// ✅ GET ALL WORK LOGS
router.get('/', auth, async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const rows = await conn.query(
      `SELECT 
          u.first_name,
          u.last_name,
          w.task,
          w.started_at,
          w.ended_at,
          TIMESTAMPDIFF(MINUTE, w.started_at, w.ended_at) AS minutes
       FROM work_log w
       JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC`
    );

    conn.release();

    res.json(rows);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;