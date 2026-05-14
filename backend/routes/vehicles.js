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

const vehicleBody = [
  body('vin').trim().notEmpty().isLength({ max: 17 }).withMessage('VIN is required (max 17 chars)'),
  body('make').trim().notEmpty().withMessage('Make is required'),
  body('model').trim().notEmpty().withMessage('Model is required'),
  body('year').isInt({ min: 1990, max: 2030 }).withMessage('Year must be between 1990 and 2030'),
  body('license_plate').trim().notEmpty().withMessage('License plate is required'),
  body('fuel_type').isIn(['diesel', 'gasoline', 'electric', 'hybrid']).withMessage('Invalid fuel_type'),
  body('status').optional().isIn(['active', 'inactive', 'maintenance']).withMessage('Invalid status'),
  body('mileage').optional().isFloat({ min: 0 }).withMessage('Mileage must be non-negative'),
  body('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be -90 to 90'),
  body('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be -180 to 180'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM vehicles');
    const result = await pool.query('SELECT * FROM vehicles ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
    res.json({
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        page: parseInt(req.query.page) || 1,
        limit,
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /:id/location — update vehicle GPS position
router.patch(
  '/:id/location',
  authenticateToken,
  [
    param('id').isInt({ min: 1 }),
    body('lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be -90 to 90'),
    body('lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be -180 to 180'),
  ],
  validate,
  async (req, res) => {
    try {
      const { lat, lng } = req.body;
      const result = await pool.query(
        'UPDATE vehicles SET lat=$1, lng=$2 WHERE id=$3 RETURNING id, lat, lng, license_plate, status',
        [lat, lng, req.params.id]
      );
      if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
      res.json(result.rows[0]);
    } catch (err) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

// GET /positions — all vehicles with current lat/lng for live map
router.get('/positions/live', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT v.id, v.license_plate, v.make, v.model, v.status, v.fuel_type, v.lat, v.lng,
             d.name as driver_name,
             (SELECT COUNT(*) FROM trips t WHERE t.vehicle_id = v.id AND t.status = 'in_progress') as active_trips
      FROM vehicles v
      LEFT JOIN drivers d ON d.vehicle_id = v.id
      ORDER BY v.id
    `);
    res.json({ data: result.rows, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', authenticateToken, vehicleBody, validate, async (req, res) => {
  try {
    const { vin, make, model, year, license_plate, fuel_type, status, mileage, lat, lng } = req.body;
    const result = await pool.query(
      'INSERT INTO vehicles (vin, make, model, year, license_plate, fuel_type, status, mileage, lat, lng) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [vin, make, model, year, license_plate, fuel_type, status || 'active', mileage || 0, lat || 0, lng || 0]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'VIN or license plate already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...vehicleBody], validate, async (req, res) => {
  try {
    const { vin, make, model, year, license_plate, fuel_type, status, mileage, lat, lng } = req.body;
    const result = await pool.query(
      'UPDATE vehicles SET vin=$1, make=$2, model=$3, year=$4, license_plate=$5, fuel_type=$6, status=$7, mileage=$8, lat=$9, lng=$10 WHERE id=$11 RETURNING *',
      [vin, make, model, year, license_plate, fuel_type, status, mileage, lat, lng, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'VIN or license plate already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM vehicles WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
    res.json({ message: 'Vehicle deleted', vehicle: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /export — stream all vehicles as CSV
router.get('/export', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vehicles ORDER BY id');
    if (result.rows.length === 0) {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="vehicles.csv"');
      return res.send('No data');
    }
    const cols = Object.keys(result.rows[0]);
    const escape = (v) => (v == null ? '' : `"${String(v).replace(/"/g, '""')}"`);
    const csv = [cols.join(','), ...result.rows.map((r) => cols.map((c) => escape(r[c])).join(','))].join('\r\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="vehicles.csv"');
    res.send(csv);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
