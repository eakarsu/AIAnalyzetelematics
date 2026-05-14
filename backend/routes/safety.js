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

const VALID_EVENT_TYPES = [
  'hard_braking', 'speeding', 'lane_departure', 'harsh_acceleration',
  'tailgating', 'distracted_driving', 'seatbelt', 'harsh_cornering',
  'fatigue', 'rolling_stop',
];

const safetyBody = [
  body('driver_id').isInt({ min: 1 }).withMessage('driver_id must be a positive integer'),
  body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
  body('event_type').isIn(VALID_EVENT_TYPES).withMessage('Invalid event_type'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  body('description').optional().trim(),
  body('location').optional().trim(),
  body('speed_at_event').optional({ nullable: true }).isFloat({ min: 0, max: 200 }).withMessage('Speed must be 0-200 mph'),
  body('date').isISO8601().withMessage('Valid date/time is required'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM safety_events');
    const result = await pool.query(`
      SELECT s.*, d.name AS driver_name, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM safety_events s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      ORDER BY s.date DESC
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
      SELECT s.*, d.name AS driver_name, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM safety_events s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      WHERE s.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Safety event not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// POST creates safety event AND recalculates driver safety score
router.post('/', authenticateToken, safetyBody, validate, async (req, res) => {
  try {
    const { driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date } = req.body;

    const result = await pool.query(
      'INSERT INTO safety_events (driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [driver_id, vehicle_id, event_type, severity, description || null, location || null, speed_at_event || null, date]
    );

    // Recalculate driver safety score based on last 90 days of events
    await recalculateDriverScore(driver_id);

    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...safetyBody], validate, async (req, res) => {
  try {
    const { driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date } = req.body;
    const result = await pool.query(
      'UPDATE safety_events SET driver_id=$1, vehicle_id=$2, event_type=$3, severity=$4, description=$5, location=$6, speed_at_event=$7, date=$8 WHERE id=$9 RETURNING *',
      [driver_id, vehicle_id, event_type, severity, description || null, location || null, speed_at_event || null, date, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Safety event not found' });

    // Recalculate driver safety score
    await recalculateDriverScore(driver_id);

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM safety_events WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Safety event not found' });

    // Recalculate driver safety score after deletion
    if (result.rows[0].driver_id) {
      await recalculateDriverScore(result.rows[0].driver_id);
    }

    res.json({ message: 'Safety event deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * Recalculate a driver's safety_score based on last 90 days of events.
 * Score starts at 100 and deducts points per event severity.
 */
async function recalculateDriverScore(driverId) {
  try {
    const severityDeductions = { low: 1, medium: 3, high: 7, critical: 15 };
    const events = await pool.query(
      "SELECT severity FROM safety_events WHERE driver_id = $1 AND date >= NOW() - INTERVAL '90 days'",
      [driverId]
    );
    let score = 100;
    for (const ev of events.rows) {
      score -= (severityDeductions[ev.severity] || 3);
    }
    score = Math.max(0, Math.min(100, score));
    await pool.query('UPDATE drivers SET safety_score = $1 WHERE id = $2', [score, driverId]);
  } catch (e) {
    console.error('recalculateDriverScore failed:', e.message);
  }
}

module.exports = router;
