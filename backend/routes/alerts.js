const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name, d.name AS driver_name
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN drivers d ON a.driver_id = d.id
      ORDER BY a.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, v.license_plate, v.make || ' ' || v.model AS vehicle_name, d.name AS driver_name
      FROM alerts a
      LEFT JOIN vehicles v ON a.vehicle_id = v.id
      LEFT JOIN drivers d ON a.driver_id = d.id
      WHERE a.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, driver_id, type, severity, message } = req.body;
    const result = await pool.query(
      'INSERT INTO alerts (vehicle_id, driver_id, type, severity, message) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [vehicle_id, driver_id || null, type, severity, message]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, driver_id, type, severity, message, is_read } = req.body;
    const result = await pool.query(
      'UPDATE alerts SET vehicle_id=$1, driver_id=$2, type=$3, severity=$4, message=$5, is_read=$6 WHERE id=$7 RETURNING *',
      [vehicle_id, driver_id, type, severity, message, is_read, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('UPDATE alerts SET is_read = TRUE WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM alerts WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json({ message: 'Alert deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
