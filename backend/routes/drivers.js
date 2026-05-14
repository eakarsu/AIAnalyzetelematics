const express = require('express');
const { body, param, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

const driverBody = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
  body('phone').optional().trim(),
  body('license_number').trim().notEmpty().withMessage('License number is required'),
  body('license_expiry').isDate().withMessage('Valid license_expiry date required'),
  body('safety_score').optional().isFloat({ min: 0, max: 100 }).withMessage('Safety score must be 0-100'),
  body('status').optional().isIn(['active', 'inactive', 'on_leave', 'suspended']).withMessage('Invalid status'),
  body('vehicle_id').optional().isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM drivers');
    const result = await pool.query(`
      SELECT d.*, v.make || ' ' || v.model AS vehicle_name, v.license_plate AS vehicle_plate
      FROM drivers d LEFT JOIN vehicles v ON d.vehicle_id = v.id
      ORDER BY d.id LIMIT $1 OFFSET $2
    `, [limit, offset]);
    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(req.query.page) || 1,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /leaderboard — drivers ranked by composite score
router.get('/leaderboard', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.id, d.name, d.safety_score, d.status, d.total_trips, d.total_miles,
             d.license_expiry,
             COUNT(DISTINCT se.id) as safety_events_30d,
             COUNT(DISTINCT t.id) as trips_30d,
             ROUND(
               (d.safety_score * 0.5 +
                LEAST(COALESCE(d.total_trips, 0) / 10.0, 30) * 0.3 +
                GREATEST(100 - COALESCE(COUNT(DISTINCT se.id), 0) * 5, 0) * 0.2
               )::numeric, 2
             ) as composite_score
      FROM drivers d
      LEFT JOIN safety_events se ON se.driver_id = d.id AND se.date >= NOW() - INTERVAL '30 days'
      LEFT JOIN trips t ON t.driver_id = d.id AND t.start_time >= NOW() - INTERVAL '30 days'
      WHERE d.status = 'active'
      GROUP BY d.id
      ORDER BY composite_score DESC
      LIMIT 20
    `);

    // Add rank and badge
    const ranked = result.rows.map((row, i) => ({
      ...row,
      rank: i + 1,
      badge: i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : null,
      license_expiring_soon: new Date(row.license_expiry) < new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
    }));

    res.json({ data: ranked, generated_at: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /expiring-licenses — drivers with licenses expiring within N days
router.get('/expiring-licenses', authenticateToken, async (req, res) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 90, 365);
    const result = await pool.query(`
      SELECT id, name, email, phone, license_number, license_expiry, status,
             (license_expiry - CURRENT_DATE) as days_until_expiry
      FROM drivers
      WHERE license_expiry <= CURRENT_DATE + INTERVAL '1 day' * $1
        AND license_expiry >= CURRENT_DATE
        AND status != 'inactive'
      ORDER BY license_expiry ASC
    `, [days]);
    res.json({ data: result.rows, days_window: days });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.get('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, v.make || ' ' || v.model AS vehicle_name, v.license_plate AS vehicle_plate
      FROM drivers d LEFT JOIN vehicles v ON d.vehicle_id = v.id WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, driverBody, validate, async (req, res) => {
  try {
    const { name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id } = req.body;
    const result = await pool.query(
      'INSERT INTO drivers (name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, email, phone || null, license_number, license_expiry, safety_score || 100, status || 'active', vehicle_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...driverBody], validate, async (req, res) => {
  try {
    const { name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id } = req.body;
    const result = await pool.query(
      'UPDATE drivers SET name=$1, email=$2, phone=$3, license_number=$4, license_expiry=$5, safety_score=$6, status=$7, vehicle_id=$8 WHERE id=$9 RETURNING *',
      [name, email, phone || null, license_number, license_expiry, safety_score, status, vehicle_id || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Email already in use' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM drivers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json({ message: 'Driver deleted', driver: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /export — stream all drivers as CSV
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name, email, phone, license_number, license_expiry, safety_score, status, total_trips, total_miles, created_at FROM drivers ORDER BY id');
    const cols = result.rows.length ? Object.keys(result.rows[0]) : [];
    const escape = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
    const csv = [cols.join(','), ...result.rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="drivers.csv"');
    res.send(csv || 'No data');
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
