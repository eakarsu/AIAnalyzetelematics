const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.name AS driver_name, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM safety_events s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      ORDER BY s.date DESC
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, d.name AS driver_name, v.license_plate, v.make || ' ' || v.model AS vehicle_name
      FROM safety_events s
      LEFT JOIN drivers d ON s.driver_id = d.id
      LEFT JOIN vehicles v ON s.vehicle_id = v.id
      WHERE s.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Safety event not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date } = req.body;
    const result = await pool.query(
      'INSERT INTO safety_events (driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',
      [driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date } = req.body;
    const result = await pool.query(
      'UPDATE safety_events SET driver_id=$1, vehicle_id=$2, event_type=$3, severity=$4, description=$5, location=$6, speed_at_event=$7, date=$8 WHERE id=$9 RETURNING *',
      [driver_id, vehicle_id, event_type, severity, description, location, speed_at_event, date, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Safety event not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM safety_events WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Safety event not found' });
    res.json({ message: 'Safety event deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
