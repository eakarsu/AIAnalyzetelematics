const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM routes ORDER BY id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM routes WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level } = req.body;
    const result = await pool.query(
      'INSERT INTO routes (name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption || null, traffic_level || 'moderate']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level, status } = req.body;
    const result = await pool.query(
      'UPDATE routes SET name=$1, origin=$2, destination=$3, distance_miles=$4, estimated_time_mins=$5, avg_fuel_consumption=$6, traffic_level=$7, status=$8 WHERE id=$9 RETURNING *',
      [name, origin, destination, distance_miles, estimated_time_mins, avg_fuel_consumption, traffic_level, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM routes WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Route not found' });
    res.json({ message: 'Route deleted', route: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
