const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, v.make || ' ' || v.model AS vehicle_name, v.license_plate AS vehicle_plate
      FROM drivers d LEFT JOIN vehicles v ON d.vehicle_id = v.id ORDER BY d.id
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, v.make || ' ' || v.model AS vehicle_name, v.license_plate AS vehicle_plate
      FROM drivers d LEFT JOIN vehicles v ON d.vehicle_id = v.id WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id } = req.body;
    const result = await pool.query(
      'INSERT INTO drivers (name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [name, email, phone, license_number, license_expiry, safety_score || 100, status || 'active', vehicle_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id } = req.body;
    const result = await pool.query(
      'UPDATE drivers SET name=$1, email=$2, phone=$3, license_number=$4, license_expiry=$5, safety_score=$6, status=$7, vehicle_id=$8 WHERE id=$9 RETURNING *',
      [name, email, phone, license_number, license_expiry, safety_score, status, vehicle_id, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM drivers WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
    res.json({ message: 'Driver deleted', driver: result.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
