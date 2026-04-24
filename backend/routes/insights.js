const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_insights ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ai_insights WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Insight not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    const { category, title, insight, confidence, data, status } = req.body;
    const result = await pool.query(
      'INSERT INTO ai_insights (category, title, insight, confidence, data, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [category, title, insight, confidence || null, data ? JSON.stringify(data) : null, status || 'new']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { category, title, insight, confidence, data, status } = req.body;
    const result = await pool.query(
      'UPDATE ai_insights SET category=$1, title=$2, insight=$3, confidence=$4, data=$5, status=$6 WHERE id=$7 RETURNING *',
      [category, title, insight, confidence, data ? JSON.stringify(data) : null, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Insight not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ai_insights WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Insight not found' });
    res.json({ message: 'Insight deleted' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
