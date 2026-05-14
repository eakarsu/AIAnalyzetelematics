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

const routeBody = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('origin').trim().notEmpty().withMessage('Origin is required'),
  body('destination').trim().notEmpty().withMessage('Destination is required'),
  body('distance_miles').isFloat({ min: 0.1 }).withMessage('distance_miles must be positive'),
  body('estimated_time_mins').isInt({ min: 1 }).withMessage('estimated_time_mins must be a positive integer'),
  body('avg_fuel_consumption').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('avg_fuel_consumption must be non-negative'),
  body('traffic_level').optional().isIn(['light', 'moderate', 'heavy']).withMessage('Invalid traffic_level'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM routes');
    const result = await pool.query('SELECT * FROM routes ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
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
    const result = await pool.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, routeBody, validate, async (req, res) => {
  try {
    const { name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level, status } = req.body;
    const result = await pool.query(
      'INSERT INTO routes (name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption || null, traffic_level || 'moderate', status || 'active']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...routeBody], validate, async (req, res) => {
  try {
    const { name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level, status } = req.body;
    const result = await pool.query(
      'UPDATE routes SET name=$1, origin=$2, destination=$3, distance_miles=$4, estimated_time_mins=$5, avg_fuel_consumption=$6, traffic_level=$7, status=$8 WHERE id=$9 RETURNING *',
      [name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption || null, traffic_level, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json({ message: 'Route deleted', route: result.rows[0] });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
