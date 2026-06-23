
import { Router } from 'express';
import { hash as _hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { getConnection } from '../config/db';

const router = Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    const hash = await _hash(password, 10);

    const conn = await getConnection();
    await conn.query(
      'INSERT INTO users (email, password_hash) VALUES (?, ?)',
      [email, hash]
    );
    conn.release();

    res.status(201).json({ message: 'User created' });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const conn = await getConnection();
    const rows = await conn.query(
      'SELECT * FROM users WHERE email = ?',
      [email]
    );
    conn.release();

    if (rows.length === 0)
      return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];

    const match = await compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ error: 'Invalid credentials' });

    const token = sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({ token });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
