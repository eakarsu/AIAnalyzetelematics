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

const VALID_TYPES = ['warehouse', 'depot', 'terminal', 'port', 'rest_area', 'customer', 'fuel', 'restricted'];

const geofenceBody = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('type').isIn(VALID_TYPES).withMessage(`type must be one of: ${VALID_TYPES.join(', ')}`),
  body('center_lat').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be -90 to 90'),
  body('center_lng').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be -180 to 180'),
  body('radius_miles').isFloat({ min: 0.1, max: 500 }).withMessage('Radius must be 0.1-500 miles'),
  body('status').optional().isIn(['active', 'inactive']).withMessage('Invalid status'),
  body('alert_on_entry').optional().isBoolean().withMessage('alert_on_entry must be boolean'),
  body('alert_on_exit').optional().isBoolean().withMessage('alert_on_exit must be boolean'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const countResult = await pool.query('SELECT COUNT(*) FROM geofences');
    const result = await pool.query('SELECT * FROM geofences ORDER BY id LIMIT $1 OFFSET $2', [limit, offset]);
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
    const result = await pool.query('SELECT * FROM geofences WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Geofence not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// POST /check-violations — check which vehicles are inside/outside each geofence
router.post('/check-violations', authenticateToken, async (req, res) => {
  try {
    const geofences = await pool.query("SELECT * FROM geofences WHERE status = 'active'");
    const vehicles = await pool.query("SELECT id, license_plate, make, model, lat, lng, status FROM vehicles WHERE status != 'inactive'");

    const violations = [];

    for (const geo of geofences.rows) {
      for (const vehicle of vehicles.rows) {
        const distanceMiles = haversineDistance(
          parseFloat(geo.center_lat), parseFloat(geo.center_lng),
          parseFloat(vehicle.lat), parseFloat(vehicle.lng)
        );
        const isInside = distanceMiles <= parseFloat(geo.radius_miles);
        // Flag as violation if vehicle is inside a restricted zone
        if (geo.type === 'restricted' && isInside) {
          violations.push({
            geofence_id: geo.id,
            geofence_name: geo.name,
            geofence_type: geo.type,
            vehicle_id: vehicle.id,
            vehicle_name: `${vehicle.make} ${vehicle.model}`,
            license_plate: vehicle.license_plate,
            distance_miles: Math.round(distanceMiles * 100) / 100,
            violation_type: 'inside_restricted_zone',
          });
        }
      }
    }

    res.json({
      violations,
      vehicles_checked: vehicles.rows.length,
      geofences_checked: geofences.rows.length,
      timestamp: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, geofenceBody, validate, async (req, res) => {
  try {
    const { name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit } = req.body;
    const result = await pool.query(
      'INSERT INTO geofences (name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, type, center_lat, center_lng, radius_miles, status || 'active', alert_on_entry !== false, alert_on_exit !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...geofenceBody], validate, async (req, res) => {
  try {
    const { name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit } = req.body;
    const result = await pool.query(
      'UPDATE geofences SET name=$1, type=$2, center_lat=$3, center_lng=$4, radius_miles=$5, status=$6, alert_on_entry=$7, alert_on_exit=$8 WHERE id=$9 RETURNING *',
      [name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Geofence not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM geofences WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Geofence not found' });
    res.json({ message: 'Geofence deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

/**
 * Haversine formula — distance in miles between two lat/lng points
 */
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg) { return (deg * Math.PI) / 180; }

module.exports = router;
