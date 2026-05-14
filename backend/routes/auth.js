const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Strict brute-force limiter for login: 10 attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

router.post(
  '/login',
  loginLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 1 }).withMessage('Password is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { email, password } = req.body;
      const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
      if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });

      const user = result.rows[0];
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) return res.status(400).json({ error: 'Invalid credentials' });

      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// Use authenticateToken middleware — consistent with all other routes
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, role FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /register (admin only) — create new users
router.post(
  '/register',
  authenticateToken,
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('role').optional().isIn(['manager', 'admin', 'viewer']).withMessage('Invalid role'),
  ],
  validate,
  async (req, res) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin role required' });
      }
      const { name, email, password, role } = req.body;
      const hashed = await bcrypt.hash(password, 12);
      const result = await pool.query(
        'INSERT INTO users (name, email, password, role) VALUES ($1,$2,$3,$4) RETURNING id, name, email, role',
        [name, email, hashed, role || 'manager']
      );
      res.status(201).json(result.rows[0]);
    } catch (err) {
      if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
