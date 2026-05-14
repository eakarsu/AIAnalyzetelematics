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

const tripBody = [
  body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
  body('driver_id').isInt({ min: 1 }).withMessage('driver_id must be a positive integer'),
  body('route_id').optional({ nullable: true }).isInt({ min: 1 }).withMessage('route_id must be a positive integer'),
  body('start_time').isISO8601().withMessage('Valid start_time is required'),
  body('end_time').optional({ nullable: true }).isISO8601().withMessage('Valid end_time'),
  body('distance_miles').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('distance_miles must be non-negative'),
  body('fuel_used').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('fuel_used must be non-negative'),
  body('avg_speed').optional({ nullable: true }).isFloat({ min: 0, max: 200 }).withMessage('avg_speed must be 0-200'),
  body('max_speed').optional({ nullable: true }).isFloat({ min: 0, max: 200 }).withMessage('max_speed must be 0-200'),
  body('status').optional().isIn(['in_progress', 'completed', 'cancelled']).withMessage('Invalid status'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;

    // Optional driver/vehicle filter
    const driverId = req.query.driver_id;
    const vehicleId = req.query.vehicle_id;
    const conditions = [];
    const params = [limit, offset];
    if (driverId) { conditions.push(`t.driver_id = $${params.length + 1}`); params.push(parseInt(driverId)); }
    if (vehicleId) { conditions.push(`t.vehicle_id = $${params.length + 1}`); params.push(parseInt(vehicleId)); }
    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countQ = conditions.length
      ? `SELECT COUNT(*) FROM trips t ${whereClause}`
      : 'SELECT COUNT(*) FROM trips';
    const countParams = params.slice(2); // strip limit/offset

    const countResult = await pool.query(countQ, countParams);
    const result = await pool.query(`
      SELECT t.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name,
             d.name AS driver_name, r.name AS route_name
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN routes r ON t.route_id = r.id
      ${whereClause}
      ORDER BY t.start_time DESC
      LIMIT $1 OFFSET $2
    `, params);
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
      SELECT t.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name,
             d.name AS driver_name, r.name AS route_name
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN routes r ON t.route_id = r.id
      WHERE t.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, tripBody, validate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status } = req.body;
    const result = await pool.query(
      'INSERT INTO trips (vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [vehicle_id, driver_id, route_id || null, start_time, end_time || null, distance_miles || null, fuel_used || null, avg_speed || null, max_speed || null, status || 'in_progress']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...tripBody], validate, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status } = req.body;
    const result = await pool.query(
      'UPDATE trips SET vehicle_id=$1, driver_id=$2, route_id=$3, start_time=$4, end_time=$5, distance_miles=$6, fuel_used=$7, avg_speed=$8, max_speed=$9, status=$10 WHERE id=$11 RETURNING *',
      [vehicle_id, driver_id, route_id || null, start_time, end_time || null, distance_miles || null, fuel_used || null, avg_speed || null, max_speed || null, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM trips WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /stats/fleet-utilization
router.get('/stats/fleet-utilization', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.make || ' ' || v.model AS vehicle_name,
        v.license_plate,
        v.status,
        COUNT(t.id) as total_trips,
        COUNT(CASE WHEN t.status = 'completed' THEN 1 END) as completed_trips,
        ROUND(SUM(COALESCE(t.distance_miles, 0))::numeric, 1) as total_miles,
        ROUND(AVG(COALESCE(t.avg_speed, 0))::numeric, 1) as avg_speed,
        MAX(t.start_time) as last_trip_at,
        CASE WHEN MAX(t.start_time) >= NOW() - INTERVAL '7 days' THEN true ELSE false END as active_last_7d
      FROM vehicles v
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.start_time >= NOW() - INTERVAL '30 days'
      GROUP BY v.id, v.make, v.model, v.license_plate, v.status
      ORDER BY total_trips DESC
    `);
    const totalVehicles = result.rows.length;
    const activeVehicles = result.rows.filter((r) => r.active_last_7d).length;
    res.json({
      data: result.rows,
      summary: {
        total_vehicles: totalVehicles,
        active_last_7d: activeVehicles,
        utilization_rate_pct: totalVehicles ? Math.round((activeVehicles / totalVehicles) * 100) : 0,
      },
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
