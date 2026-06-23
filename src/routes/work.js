import { Router } from 'express';
import { getConnection } from '../config/db';
import auth from '../middleware/auth';

const router = Router();

// ADD WORK
router.post('/', auth, async (req, res) => {
  const { task, started_at, ended_at } = req.body;

  const conn = await getConnection();

  await conn.query(
    `INSERT INTO work_log (user_id, task, started_at, ended_at)
     VALUES (?, ?, ?, ?)`,
    [
      req.user.id,
      task,
      started_at || new Date(), // default = now
      ended_at
    ]
  );

  conn.release();

  res.json({ message: 'Work added' });
});

// GET ALL WORK
router.get('/', auth, async (req, res) => {
  const conn = await getConnection();

  const rows = await conn.query(
    `SELECT 
        u.email,
        w.task,
        w.started_at,
        w.ended_at,
        TIMESTAMPDIFF(MINUTE, w.started_at, w.ended_at) as minutes
     FROM work_log w
     JOIN users u ON w.user_id = u.id
     ORDER BY w.created_at DESC`
  );

  conn.release();

  res.json(rows);
});

export default router;