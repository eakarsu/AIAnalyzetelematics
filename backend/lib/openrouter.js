/**
 * Shared OpenRouter + AI utility library.
 * Used by routes/ai.js and routes/analytics.js.
 */
const https = require('https');
const pool = require('../db');

const DEFAULT_MODEL = 'anthropic/claude-3-5-sonnet-20241022';
const REQUEST_TIMEOUT_MS = 45_000; // 45 seconds

/**
 * Call the OpenRouter chat completions API.
 * Enforces a 45-second timeout via a hard socket destroy.
 */
function callOpenRouter(prompt, systemPrompt = null) {
  return new Promise((resolve, reject) => {
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const data = JSON.stringify({
      model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
      messages,
      max_tokens: 4000,
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': process.env.CLIENT_URL || process.env.CORS_ORIGIN || 'http://localhost:3000',
        'X-Title': 'FleetIQ Telematics',
      },
    };

    let settled = false;

    // Hard timeout — destroy socket if OpenRouter is unresponsive
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        req.destroy(new Error('OpenRouter request timed out after 45 seconds'));
      }
    }, REQUEST_TIMEOUT_MS);

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        clearTimeout(timer);
        if (settled) return;
        settled = true;
        try {
          const parsed = JSON.parse(body);
          if (parsed.error) {
            reject(new Error(parsed.error.message || 'OpenRouter API error'));
          } else {
            resolve(parsed);
          }
        } catch (e) {
          reject(new Error('Failed to parse OpenRouter response'));
        }
      });
    });

    req.on('error', (err) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    req.write(data);
    req.end();
  });
}

/**
 * 3-strategy JSON parser:
 * 1. Direct JSON.parse
 * 2. Strip markdown code fences then parse
 * 3. Extract outermost { ... } block then parse
 */
function parseAIJson(text) {
  if (!text || typeof text !== 'string') return null;
  try { return JSON.parse(text); } catch (e) { /* try next */ }
  const stripped = text.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
  try { return JSON.parse(stripped); } catch (e) { /* try next */ }
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch (e) { /* no luck */ }
  }
  return null;
}

/**
 * Ensure the ai_results persistence table exists (idempotent).
 */
async function ensureAIResultsTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_results (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      analysis_type VARCHAR(100) NOT NULL,
      input_data JSONB,
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}
ensureAIResultsTable().catch((e) => console.error('ensureAIResultsTable failed:', e.message));

/**
 * Persist an AI result to the ai_results table.
 * @param {number|null} userId
 * @param {string} analysisType
 * @param {object} inputData
 * @param {object} result
 */
async function saveAIResult(userId, analysisType, inputData, result) {
  try {
    await pool.query(
      'INSERT INTO ai_results (user_id, analysis_type, input_data, result) VALUES ($1, $2, $3, $4)',
      [userId || null, analysisType, JSON.stringify(inputData), JSON.stringify(result)]
    );
  } catch (e) {
    console.error('saveAIResult failed:', e.message);
  }
}

module.exports = { callOpenRouter, parseAIJson, saveAIResult };
