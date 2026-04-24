const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT t.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name,
             d.name AS driver_name, r.name AS route_name
      FROM trips t
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      LEFT JOIN drivers d ON t.driver_id = d.id
      LEFT JOIN routes r ON t.route_id = r.id
      ORDER BY t.start_time DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
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
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status } = req.body;
    const result = await pool.query(
      'INSERT INTO trips (vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
      [vehicle_id, driver_id, route_id, start_time, end_time || null, distance_miles || null, fuel_used || null, avg_speed || null, max_speed || null, status || 'in_progress']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status } = req.body;
    const result = await pool.query(
      'UPDATE trips SET vehicle_id=$1, driver_id=$2, route_id=$3, start_time=$4, end_time=$5, distance_miles=$6, fuel_used=$7, avg_speed=$8, max_speed=$9, status=$10 WHERE id=$11 RETURNING *',
      [vehicle_id, driver_id, route_id, start_time, end_time, distance_miles, fuel_used, avg_speed, max_speed, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM trips WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });
    res.json({ message: 'Trip deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
