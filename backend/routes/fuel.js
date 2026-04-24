const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name,
             d.name AS driver_name, r.name AS route_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN routes r ON f.route_id = r.id
      ORDER BY f.date DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location } = req.body;
    const result = await pool.query(
      'INSERT INTO fuel_logs (vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [vehicle_id, driver_id || null, route_id || null, gallons, cost, mpg || null, date, location || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location } = req.body;
    const result = await pool.query(
      'UPDATE fuel_logs SET vehicle_id=$1, driver_id=$2, route_id=$3, gallons=$4, cost=$5, mpg=$6, date=$7, location=$8 WHERE id=$9 RETURNING *',
      [vehicle_id, driver_id, route_id, gallons, cost, mpg, date, location, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fuel log not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM fuel_logs WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Fuel log not found' });
    res.json({ message: 'Fuel log deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
