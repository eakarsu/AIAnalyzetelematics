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

const alertBody = [
  body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
  body('driver_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('driver_id must be a positive integer'),
  body('type').isIn(['maintenance', 'safety', 'fuel', 'performance', 'geofence', 'weather', 'compliance']).withMessage('Invalid type'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  body('message').trim().notEmpty().isLength({ max: 1000 }).withMessage('Message is required (max 1000 chars)'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;

    // Optional filters
    const unreadOnly = req.query.unread === 'true';
    const whereClause = unreadOnly ? 'WHERE a.is_read = false' : '';
    const countResult = await pool.query(
      unreadOnly ? 'SELECT COUNT(*) FROM alerts WHERE is_read = false' : 'SELECT COUNT(*) FROM alerts'
    );

    const result = await pool.query(`
      SELECT a.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name, d.name AS driver_name
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN drivers d ON a.driver_id = d.id
      ${whereClause}
      ORDER BY a.created_at DESC
      LIMIT $1 OFFSET $2
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

router.get('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name, d.name AS driver_name
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN drivers d ON a.driver_id = d.id
      WHERE a.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, alertBody, validate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, type, severity, message } = req.body;
    const result = await pool.query(
      'INSERT INTO alerts (vehicle_id, driver_id, type, severity, message) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [vehicle_id, driver_id || null, type, severity, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...alertBody], validate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, type, severity, message, is_read } = req.body;
    const result = await pool.query(
      'UPDATE alerts SET vehicle_id=$1, driver_id=$2, type=$3, severity=$4, message=$5, is_read=$6 WHERE id=$7 RETURNING *',
      [vehicle_id, driver_id || null, type, severity, message, is_read !== undefined ? is_read : false, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Mark single alert as read
router.put('/:id/read', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// Mark ALL unread alerts as read
router.put('/bulk/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query("UPDATE alerts SET is_read = TRUE WHERE is_read = FALSE RETURNING id");
    res.json({ message: `Marked ${result.rowCount} alerts as read`, updated_ids: result.rows.map((r) => r.id) });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
