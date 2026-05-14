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

const maintenanceBody = [
  body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
  body('type').trim().notEmpty().withMessage('Type is required'),
  body('description').optional().trim(),
  body('scheduled_date').isDate().withMessage('Valid scheduled_date is required'),
  body('completed_date').optional({ nullable: true }).isDate().withMessage('Valid completed_date'),
  body('cost').optional({ nullable: true }).isFloat({ min: 0 }).withMessage('cost must be non-negative'),
  body('status').optional().isIn(['scheduled', 'in_progress', 'completed', 'cancelled', 'awaiting_parts']).withMessage('Invalid status'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid priority'),
  body('mileage_at_service').optional({ nullable: true }).isInt({ min: 0 }).withMessage('Mileage must be non-negative'),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;

    // Optional status filter
    const statusFilter = req.query.status;
    const whereClause = statusFilter ? "WHERE m.status = $3" : "";
    const queryParams = statusFilter ? [limit, offset, statusFilter] : [limit, offset];

    const countResult = await pool.query(
      statusFilter ? 'SELECT COUNT(*) FROM maintenance WHERE status = $1' : 'SELECT COUNT(*) FROM maintenance',
      statusFilter ? [statusFilter] : []
    );
    const result = await pool.query(`
      SELECT m.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM maintenance m LEFT JOIN vehicles v ON m.vehicle_id = v.id
      ${whereClause}
      ORDER BY m.scheduled_date
      LIMIT $1 OFFSET $2
    `, queryParams);
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
      SELECT m.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM maintenance m LEFT JOIN vehicles v ON m.vehicle_id = v.id WHERE m.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, maintenanceBody, validate, async (req, res) => {
  try {
    const { vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service } = req.body;
    const result = await pool.query(
      'INSERT INTO maintenance (vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [vehicle_id, type, description || null, scheduled_date, completed_date || null, cost || null, status || 'scheduled', priority || 'medium', mileage_at_service || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...maintenanceBody], validate, async (req, res) => {
  try {
    const { vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service } = req.body;
    const result = await pool.query(
      'UPDATE maintenance SET vehicle_id=$1, type=$2, description=$3, scheduled_date=$4, completed_date=$5, cost=$6, status=$7, priority=$8, mileage_at_service=$9 WHERE id=$10 RETURNING *',
      [vehicle_id, type, description || null, scheduled_date, completed_date || null, cost || null, status, priority, mileage_at_service || null, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM maintenance WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json({ message: 'Maintenance record deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// GET /cost-per-mile — per vehicle cost breakdown
router.get('/stats/cost-per-mile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.make || ' ' || v.model AS vehicle_name,
        v.license_plate,
        v.mileage,
        ROUND(SUM(COALESCE(m.cost, 0))::numeric, 2) AS total_maintenance_cost,
        COUNT(m.id) AS maintenance_count,
        ROUND((SUM(COALESCE(m.cost, 0)) / NULLIF(v.mileage, 0) * 1000)::numeric, 4) AS cost_per_1000_miles
      FROM vehicles v
      LEFT JOIN maintenance m ON m.vehicle_id = v.id AND m.status = 'completed'
      GROUP BY v.id, v.make, v.model, v.license_plate, v.mileage
      ORDER BY cost_per_1000_miles DESC NULLS LAST
    `);
    res.json({ data: result.rows });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
