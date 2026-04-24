const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM maintenance m LEFT JOIN vehicles v ON m.vehicle_id = v.id ORDER BY m.scheduled_date
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM maintenance m LEFT JOIN vehicles v ON m.vehicle_id = v.id WHERE m.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service } = req.body;
    const result = await pool.query(
      'INSERT INTO maintenance (vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
      [vehicle_id, type, description, scheduled_date, completed_date || null, cost || null, status || 'scheduled', priority || 'medium', mileage_at_service || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service } = req.body;
    const result = await pool.query(
      'UPDATE maintenance SET vehicle_id=$1, type=$2, description=$3, scheduled_date=$4, completed_date=$5, cost=$6, status=$7, priority=$8, mileage_at_service=$9 WHERE id=$10 RETURNING *',
      [vehicle_id, type, description, scheduled_date, completed_date, cost, status, priority, mileage_at_service, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM maintenance WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Maintenance record not found' });
    res.json({ message: 'Maintenance record deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
