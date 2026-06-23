const express = require('express');
const pool = require('../config/db');
const auth = require('../middleware/auth');

const router = express.Router();

// ADD WORK
router.post('/', auth, async (req, res) => {
    console.log("WORK HIT");
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


// GET WORK
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
          CAST(TIMESTAMPDIFF(MINUTE, w.started_at, w.ended_at) AS SIGNED) AS minutes
       FROM work_logs w
       JOIN users u ON w.user_id = u.id
       ORDER BY w.created_at DESC`
    );

    conn.release();

    //res.json(rows);
    
    const safeRows = rows.map(row => {
    return Object.fromEntries(
        Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'bigint' ? Number(value) : value
        ])
    );
    console.log(rows);
    });

    res.json(safeRows);


  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;