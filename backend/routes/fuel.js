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

const fuelBody = [
  body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
  body('driver_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('driver_id must be a positive integer'),
  body('route_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('route_id must be a positive integer'),
  body('gallons').isFloat({ min: 0.1 }).withMessage('gallons must be positive'),
  body('cost').isFloat({ min: 0 }).withMessage('cost must be non-negative'),
  body('mpg').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('mpg must be non-negative'),
  body('date').isDate().withMessage('Valid date is required'),
  body('location').optional().trim(),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM fuel_logs');
    const result = await pool.query(`
      SELECT f.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name,
             d.name AS driver_name, r.name AS route_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN routes r ON f.route_id = r.id
      ORDER BY f.date DESC
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
      SELECT f.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name,
             d.name AS driver_name, r.name AS route_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN routes r ON f.route_id = r.id
      WHERE f.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fuel log not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, fuelBody, validate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location } = req.body;
    const result = await pool.query(
      'INSERT INTO fuel_logs (vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [vehicle_id, driver_id || null, route_id || null, gallons, cost, mpg || null, date, location || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...fuelBody], validate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location } = req.body;
    const result = await pool.query(
      'UPDATE fuel_logs SET vehicle_id=$1, driver_id=$2, route_id=$3, gallons=$4, cost=$5, mpg=$6, date=$7, location=$8 WHERE id=$9 RETURNING *',
      [vehicle_id, driver_id || null, route_id || null, gallons, cost, mpg || null, date, location || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fuel log not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM fuel_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fuel log not found' });
    res.json({ message: 'Fuel log deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /stats/summary — fuel cost per vehicle per month
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.make || ' ' || v.model AS vehicle_name,
        v.license_plate,
        v.fuel_type,
        TO_CHAR(f.date, 'YYYY-MM') AS month,
        SUM(f.gallons) AS total_gallons,
        SUM(f.cost) AS total_cost,
        ROUND(AVG(f.mpg)::numeric, 2) AS avg_mpg,
        COUNT(*) AS fill_up_count,
        ROUND((SUM(f.cost) / NULLIF(SUM(f.gallons), 0))::numeric, 3) AS cost_per_gallon
      FROM fuel_logs f
      JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.date >= CURRENT_DATE - INTERVAL '6 months'
      GROUP BY v.id, v.make, v.model, v.license_plate, v.fuel_type, TO_CHAR(f.date, 'YYYY-MM')
      ORDER BY month DESC, total_cost DESC
    `);
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
