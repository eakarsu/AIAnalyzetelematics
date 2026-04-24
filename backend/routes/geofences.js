const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM geofences ORDER BY id');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM geofences WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Geofence not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit } = req.body;
    const result = await pool.query(
      'INSERT INTO geofences (name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, type, center_lat, center_lng, radius_miles, status || 'active', alert_on_entry !== false, alert_on_exit !== false]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit } = req.body;
    const result = await pool.query(
      'UPDATE geofences SET name=$1, type=$2, center_lat=$3, center_lng=$4, radius_miles=$5, status=$6, alert_on_entry=$7, alert_on_exit=$8 WHERE id=$9 RETURNING *',
      [name, type, center_lat, center_lng, radius_miles, status, alert_on_entry, alert_on_exit, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Geofence not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM geofences WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Geofence not found' });
    res.json({ message: 'Geofence deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
