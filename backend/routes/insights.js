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

const VALID_CATEGORIES = ['fuel', 'safety', 'maintenance', 'routing', 'performance'];
const VALID_STATUSES = ['new', 'acknowledged', 'resolved', 'dismissed'];

const insightBody = [
  body('category').isIn(VALID_CATEGORIES).withMessage(`category must be one of: ${VALID_CATEGORIES.join(', ')}`),
  body('title').trim().notEmpty().isLength({ max: 255 }).withMessage('Title is required (max 255 chars)'),
  body('insight').trim().notEmpty().withMessage('Insight text is required'),
  body('confidence').optional({ nullable: true }).isFloat({ min: 0, max: 100 }).withMessage('Confidence must be 0-100'),
  body('status').optional().isIn(VALID_STATUSES).withMessage(`status must be one of: ${VALID_STATUSES.join(', ')}`),
];

router.get('/', authenticateToken, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const offset = ((parseInt(req.query.page) || 1) - 1) * limit;
    const statusFilter = req.query.status;
    const categoryFilter = req.query.category;

    const conditions = [];
    const params = [];
    if (statusFilter) { conditions.push(`status = $${params.length + 1}`); params.push(statusFilter); }
    if (categoryFilter) { conditions.push(`category = $${params.length + 1}`); params.push(categoryFilter); }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const countResult = await pool.query(
      `SELECT COUNT(*) FROM ai_insights ${whereClause}`,
      params
    );
    const result = await pool.query(
      `SELECT * FROM ai_insights ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset]
    );
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
    const result = await pool.query('SELECT * FROM ai_insights WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Insight not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.post('/', authenticateToken, insightBody, validate, async (req, res) => {
  try {
    const { category, title, insight, confidence, data, status } = req.body;
    const result = await pool.query(
      'INSERT INTO ai_insights (category, title, insight, confidence, data, status) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [category, title, insight, confidence || null, data ? JSON.stringify(data) : null, status || 'new']
    );
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.put('/:id', authenticateToken, [param('id').isInt({ min: 1 }), ...insightBody], validate, async (req, res) => {
  try {
    const { category, title, insight, confidence, data, status } = req.body;
    const result = await pool.query(
      'UPDATE ai_insights SET category=$1, title=$2, insight=$3, confidence=$4, data=$5, status=$6 WHERE id=$7 RETURNING *',
      [category, title, insight, confidence || null, data ? JSON.stringify(data) : null, status, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Insight not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

router.delete('/:id', authenticateToken, [param('id').isInt({ min: 1 })], validate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ai_insights WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Insight not found' });
    res.json({ message: 'Insight deleted' });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
