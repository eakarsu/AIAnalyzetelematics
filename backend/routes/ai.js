const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter, parseAIJson, saveAIResult } = require('../lib/openrouter');
const router = express.Router();

// ─── In-memory cache (5-minute TTL) ────────────────────────────────────────
const statsCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
  const entry = statsCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { statsCache.delete(key); return null; }
  return entry.data;
}
function setCache(key, data) { statsCache.set(key, { data, ts: Date.now() }); }

// ─── Rate limiter: 20 AI requests per user per hour ────────────────────────
const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => `user_${req.user?.id || 'anon'}`,
  message: { error: 'Too many AI requests. Limit is 20 per hour per user.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: { ip: false },
});

function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
  next();
}

// ─── AI Route Optimization (upgraded to structured JSON) ───────────────────
router.post('/optimize-route', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const routes = await pool.query('SELECT * FROM routes ORDER BY id LIMIT 16');
    const fuelData = await pool.query(`
      SELECT r.name, ROUND(AVG(f.mpg)::numeric,2) as avg_mpg, ROUND(SUM(f.gallons)::numeric,2) as total_gallons, COUNT(*) as trips
      FROM fuel_logs f JOIN routes r ON f.route_id = r.id GROUP BY r.name
    `);

    const systemPrompt = 'You are a fleet route optimization AI. Always respond with valid JSON only — no markdown, no prose outside JSON.';
    const prompt = `Analyze this route and fuel data and provide optimization recommendations.

Routes: ${JSON.stringify(routes.rows)}
Fuel Data by Route: ${JSON.stringify(fuelData.rows)}

Respond ONLY with valid JSON:
{
  "summary": "string",
  "top_routes_to_optimize": [
    {
      "route_name": "string",
      "current_avg_mpg": 0,
      "issue": "string",
      "recommendation": "string",
      "estimated_fuel_savings_pct": 0,
      "priority": "critical|high|medium|low",
      "specific_actions": ["string"]
    }
  ],
  "fleet_wide_savings_estimate": {
    "fuel_reduction_pct": 0,
    "monthly_cost_savings_usd": 0,
    "co2_reduction_lbs": 0
  },
  "optimal_departure_windows": ["string"],
  "consolidation_opportunities": ["string"]
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };

    await saveAIResult(req.user?.id, 'optimize-route', { routes: routes.rows.length }, parsed);

    res.json({
      ...parsed,
      model: response?.model,
      usage: response?.usage,
      timestamp: new Date().toISOString(),
      category: 'route_optimization',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI Fuel Analysis (upgraded to structured JSON) ─────────────────────────
router.post('/analyze-fuel', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const fuelData = await pool.query(`
      SELECT f.*, v.make, v.model, v.fuel_type, v.license_plate, d.name as driver_name, r.name as route_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN routes r ON f.route_id = r.id
      ORDER BY f.date DESC LIMIT 30
    `);

    const systemPrompt = 'You are a fleet fuel efficiency analyst AI. Always respond with valid JSON only.';
    const prompt = `Analyze this fuel consumption data.

Fuel Log Data: ${JSON.stringify(fuelData.rows)}

Respond ONLY with valid JSON:
{
  "overall_assessment": "excellent|good|fair|poor",
  "fleet_avg_mpg": 0,
  "monthly_fuel_cost_usd": 0,
  "worst_performing_vehicles": [
    { "license_plate": "string", "vehicle": "string", "avg_mpg": 0, "root_cause": "string", "estimated_monthly_waste_usd": 0 }
  ],
  "cost_optimization_opportunities": [
    { "opportunity": "string", "estimated_annual_savings_usd": 0, "difficulty": "easy|medium|hard" }
  ],
  "environmental_impact": {
    "estimated_co2_lbs_30d": 0,
    "ev_switch_co2_reduction_pct": 0
  },
  "recommendations": [{ "action": "string", "impact": "high|medium|low", "timeline": "string" }],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };

    await saveAIResult(req.user?.id, 'analyze-fuel', { fuel_logs: fuelData.rows.length }, parsed);

    res.json({
      ...parsed,
      model: response?.model,
      usage: response?.usage,
      timestamp: new Date().toISOString(),
      category: 'fuel_analysis',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI Driver Behavior Analysis (upgraded to structured JSON) ──────────────
router.post('/analyze-drivers', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const drivers = await pool.query('SELECT * FROM drivers ORDER BY safety_score ASC LIMIT 20');
    const safetyEvents = await pool.query(`
      SELECT s.*, d.name as driver_name FROM safety_events s
      JOIN drivers d ON s.driver_id = d.id ORDER BY s.date DESC LIMIT 30
    `);

    const systemPrompt = 'You are a driver safety and behavior analyst AI. Always respond with valid JSON only.';
    const prompt = `Analyze driver performance and safety data.

Driver Data: ${JSON.stringify(drivers.rows)}
Recent Safety Events: ${JSON.stringify(safetyEvents.rows)}

Respond ONLY with valid JSON:
{
  "driver_risk_categories": {
    "critical": [{ "driver_id": 0, "name": "string", "safety_score": 0, "primary_issue": "string" }],
    "high": [{ "driver_id": 0, "name": "string", "safety_score": 0, "primary_issue": "string" }],
    "medium": [{ "driver_id": 0, "name": "string", "safety_score": 0 }],
    "low": [{ "driver_id": 0, "name": "string", "safety_score": 0 }]
  },
  "common_unsafe_behaviors": [{ "behavior": "string", "count": 0, "peak_time": "string" }],
  "training_recommendations": [{ "driver_id": 0, "driver_name": "string", "recommended_modules": ["string"] }],
  "fatigue_risk_drivers": [{ "driver_id": 0, "name": "string", "risk_level": "high|critical", "reason": "string" }],
  "top_performers": [{ "driver_id": 0, "name": "string", "safety_score": 0, "recognition": "string" }],
  "predicted_score_changes_30d": [{ "driver_id": 0, "name": "string", "current_score": 0, "predicted_score": 0, "trend": "improving|worsening|stable" }],
  "immediate_actions": ["string"],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };

    await saveAIResult(req.user?.id, 'analyze-drivers', { drivers: drivers.rows.length }, parsed);

    res.json({
      ...parsed,
      model: response?.model,
      usage: response?.usage,
      timestamp: new Date().toISOString(),
      category: 'driver_analysis',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI Predictive Maintenance (upgraded to structured JSON) ────────────────
router.post('/predict-maintenance', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const vehicles = await pool.query('SELECT * FROM vehicles ORDER BY mileage DESC');
    const maintenance = await pool.query(`
      SELECT m.*, v.make, v.model, v.mileage, v.license_plate
      FROM maintenance m JOIN vehicles v ON m.vehicle_id = v.id ORDER BY m.scheduled_date
    `);

    const systemPrompt = 'You are a predictive maintenance AI for a commercial fleet. Always respond with valid JSON only.';
    const prompt = `Analyze vehicle and maintenance data.

Vehicle Fleet: ${JSON.stringify(vehicles.rows)}
Maintenance History: ${JSON.stringify(maintenance.rows)}

Respond ONLY with valid JSON:
{
  "unscheduled_risk_vehicles": [
    { "vehicle_id": 0, "license_plate": "string", "vehicle": "string", "predicted_issue": "string", "probability_pct": 0, "timeframe_days": 0, "estimated_cost_usd": 0 }
  ],
  "cost_forecast_60d_usd": 0,
  "optimal_maintenance_schedule": [
    { "vehicle_id": 0, "type": "string", "recommended_date": "YYYY-MM-DD", "rationale": "string" }
  ],
  "parts_to_preorder": [{ "part": "string", "quantity": 0, "for_vehicles": ["string"] }],
  "retirement_candidates": [{ "vehicle_id": 0, "license_plate": "string", "reason": "string", "estimated_remaining_months": 0 }],
  "preventive_vs_reactive_roi": { "preventive_cost_usd": 0, "reactive_risk_cost_usd": 0, "roi_pct": 0 },
  "component_failure_predictions": [
    { "vehicle_id": 0, "component": "string", "failure_probability_pct": 0, "predicted_failure_date": "YYYY-MM-DD" }
  ],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };

    await saveAIResult(req.user?.id, 'predict-maintenance', { vehicles: vehicles.rows.length }, parsed);

    res.json({
      ...parsed,
      model: response?.model,
      usage: response?.usage,
      timestamp: new Date().toISOString(),
      category: 'predictive_maintenance',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── AI Fleet Insights (upgraded to structured JSON) ────────────────────────
router.post('/fleet-insights', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'active') as active_vehicles,
        (SELECT COUNT(*) FROM drivers) as total_drivers,
        (SELECT COUNT(*) FROM trips WHERE status = 'in_progress') as active_trips,
        (SELECT COUNT(*) FROM alerts WHERE is_read = false) as unread_alerts,
        (SELECT COUNT(*) FROM maintenance WHERE status = 'scheduled') as pending_maintenance,
        (SELECT ROUND(AVG(safety_score)::numeric, 1) FROM drivers) as avg_safety_score,
        (SELECT ROUND(SUM(cost)::numeric, 2) FROM fuel_logs WHERE date >= CURRENT_DATE - INTERVAL '30 days') as monthly_fuel_cost
    `);
    const insights = await pool.query('SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 10');

    const systemPrompt = 'You are a fleet management executive AI advisor. Always respond with valid JSON only.';
    const prompt = `Provide a comprehensive fleet health report.

Fleet Statistics: ${JSON.stringify(stats.rows[0])}
Recent AI Insights: ${JSON.stringify(insights.rows)}

Respond ONLY with valid JSON:
{
  "executive_summary": "string",
  "fleet_health_score": 0,
  "kpis": [
    { "name": "string", "value": "string", "status": "good|warning|critical", "benchmark": "string" }
  ],
  "top_action_items": [
    { "action": "string", "urgency": "immediate|this_week|this_month", "business_impact": "high|medium|low", "estimated_savings_usd": 0 }
  ],
  "cost_optimization_opportunities": [{ "opportunity": "string", "estimated_annual_savings_usd": 0 }],
  "sustainability_metrics": { "current_co2_estimate_lbs_monthly": 0, "improvement_target_pct": 0 },
  "thirty_day_outlook": "string",
  "risk_factors": ["string"],
  "benchmarking_recommendations": ["string"]
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };

    await saveAIResult(req.user?.id, 'fleet-insights', {}, parsed);

    res.json({
      ...parsed,
      model: response?.model,
      usage: response?.usage,
      timestamp: new Date().toISOString(),
      category: 'fleet_insights',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Dashboard Stats (cached) ────────────────────────────────────────────────
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
  try {
    const cacheKey = `dashboard_stats_${req.user.id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, _cached: true });

    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'active') as active_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'maintenance') as vehicles_in_maintenance,
        (SELECT COUNT(*) FROM drivers) as total_drivers,
        (SELECT COUNT(*) FROM drivers WHERE status = 'active') as active_drivers,
        (SELECT COUNT(*) FROM trips) as total_trips,
        (SELECT COUNT(*) FROM trips WHERE status = 'in_progress') as active_trips,
        (SELECT COUNT(*) FROM alerts WHERE is_read = false) as unread_alerts,
        (SELECT COUNT(*) FROM maintenance WHERE status = 'scheduled') as pending_maintenance,
        (SELECT ROUND(AVG(safety_score)::numeric, 1) FROM drivers) as avg_safety_score,
        (SELECT ROUND(SUM(cost)::numeric, 2) FROM fuel_logs WHERE date >= CURRENT_DATE - INTERVAL '30 days') as monthly_fuel_cost,
        (SELECT ROUND(AVG(mpg)::numeric, 1) FROM fuel_logs WHERE date >= CURRENT_DATE - INTERVAL '30 days') as avg_mpg,
        (SELECT COUNT(*) FROM geofences WHERE status = 'active') as active_geofences,
        (SELECT COUNT(*) FROM ai_insights WHERE status = 'new') as new_insights,
        (SELECT COUNT(*) FROM safety_events WHERE date >= CURRENT_DATE - INTERVAL '7 days') as weekly_safety_events,
        (SELECT ROUND(SUM(distance_miles)::numeric, 0) FROM trips WHERE start_time >= CURRENT_DATE - INTERVAL '30 days') as monthly_miles
    `);

    const data = stats.rows[0];
    setCache(cacheKey, data);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Driver Coaching Bot ────────────────────────────────────────────────────
router.post(
  '/driver-coaching',
  authenticateToken,
  aiRateLimiter,
  [body('driver_id').isInt({ min: 1 }).withMessage('driver_id must be a positive integer')],
  validate,
  async (req, res) => {
    try {
      const { driver_id } = req.body;

      await pool.query(`
        CREATE TABLE IF NOT EXISTS driver_coaching (
          id SERIAL PRIMARY KEY,
          driver_id INTEGER NOT NULL,
          coaching_text TEXT NOT NULL,
          safety_score_before NUMERIC(5,2),
          generated_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      const driverResult = await pool.query('SELECT * FROM drivers WHERE id = $1', [driver_id]);
      if (driverResult.rows.length === 0) return res.status(404).json({ error: 'Driver not found' });
      const driver = driverResult.rows[0];

      const eventsResult = await pool.query(`
        SELECT event_type, severity, description, location, speed_at_event, date
        FROM safety_events
        WHERE driver_id = $1 AND date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY date DESC
      `, [driver_id]);

      const systemPrompt = 'You are a fleet safety expert and driver coach. Respond with valid JSON only.';
      const prompt = `Generate personalized coaching for this driver.

Driver Profile:
Name: ${driver.name}
Safety Score: ${driver.safety_score}/100
Status: ${driver.status}
License Expiry: ${driver.license_expiry}

Safety Events (Last 30 Days):
${JSON.stringify(eventsResult.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "coaching_message": "string",
  "specific_corrections": [{ "behavior": "string", "correction": "string", "target_metric": "string" }],
  "improvement_targets": [{ "metric": "string", "current": "string", "target": "string", "timeframe_days": 30 }],
  "recommended_training_modules": [{ "module": "string", "reason": "string", "priority": "high|medium|low" }],
  "strengths_acknowledged": ["string"],
  "thirty_day_action_plan": [{ "week": 1, "actions": ["string"] }],
  "predicted_score_improvement": 0
}`;

      const response = await callOpenRouter(prompt, systemPrompt);
      const content = response?.choices?.[0]?.message?.content || '';
      const parsed = parseAIJson(content) || { raw_response: content };

      const saved = await pool.query(`
        INSERT INTO driver_coaching (driver_id, coaching_text, safety_score_before, generated_at)
        VALUES ($1, $2, $3, NOW()) RETURNING *
      `, [driver_id, JSON.stringify(parsed), driver.safety_score]);

      await saveAIResult(req.user?.id, 'driver-coaching', { driver_id, driver_name: driver.name }, parsed);

      res.json({
        ...parsed,
        driver: { id: driver.id, name: driver.name, safety_score: driver.safety_score },
        events_analyzed: eventsResult.rows.length,
        saved_record: saved.rows[0],
        model: response?.model,
        timestamp: new Date().toISOString(),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── Real-time Route Recommendation ────────────────────────────────────────
router.post(
  '/route-recommendation',
  authenticateToken,
  aiRateLimiter,
  [
    body('vehicle_id').isInt({ min: 1 }).withMessage('vehicle_id must be a positive integer'),
    body('destination').isString().trim().notEmpty().withMessage('destination is required'),
  ],
  validate,
  async (req, res) => {
    try {
      const { vehicle_id, destination } = req.body;

      const vehicleResult = await pool.query(`
        SELECT v.*, d.name as driver_name
        FROM vehicles v LEFT JOIN drivers d ON v.id = d.vehicle_id
        WHERE v.id = $1
      `, [vehicle_id]);
      if (vehicleResult.rows.length === 0) return res.status(404).json({ error: 'Vehicle not found' });
      const vehicle = vehicleResult.rows[0];

      const tripResult = await pool.query(`
        SELECT t.*, r.name as route_name, r.distance_miles, r.estimated_time_mins, r.traffic_level
        FROM trips t LEFT JOIN routes r ON t.route_id = r.id
        WHERE t.vehicle_id = $1 ORDER BY t.start_time DESC LIMIT 1
      `, [vehicle_id]);

      const fuelResult = await pool.query(
        'SELECT gallons, mpg, cost, date FROM fuel_logs WHERE vehicle_id = $1 ORDER BY date DESC LIMIT 5',
        [vehicle_id]
      );

      const systemPrompt = 'You are a real-time fleet route optimization AI. Respond with valid JSON only.';
      const prompt = `Recommend optimal routes for this vehicle.

Vehicle: ${vehicle.make} ${vehicle.model} (${vehicle.license_plate})
Fuel Type: ${vehicle.fuel_type}
Current Mileage: ${vehicle.mileage}
Driver: ${vehicle.driver_name || 'Unassigned'}
Destination: ${destination}

Current/Last Route: ${tripResult.rows.length > 0 ? JSON.stringify(tripResult.rows[0]) : 'No active route data'}
Recent Fuel Performance: ${JSON.stringify(fuelResult.rows)}

Respond ONLY with valid JSON:
{
  "top_route_options": [
    { "rank": 1, "route_name": "string", "estimated_miles": 0, "estimated_time_mins": 0, "estimated_fuel_gallons": 0, "estimated_fuel_cost_usd": 0, "rationale": "string" }
  ],
  "recommended_route": { "rank": 1, "reason": "string" },
  "best_departure_time": "string",
  "fuel_savings_vs_current": { "pct": 0, "usd": 0 },
  "vehicle_specific_notes": "string",
  "traffic_warnings": ["string"]
}`;

      const response = await callOpenRouter(prompt, systemPrompt);
      const content = response?.choices?.[0]?.message?.content || '';
      const parsed = parseAIJson(content) || { raw_response: content };

      await saveAIResult(req.user?.id, 'route-recommendation', { vehicle_id, destination }, parsed);

      res.json({
        ...parsed,
        vehicle: { id: vehicle.id, name: `${vehicle.make} ${vehicle.model}`, plate: vehicle.license_plate },
        destination,
        model: response?.model,
        timestamp: new Date().toISOString(),
      });
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── Fuel Waste Detector ────────────────────────────────────────────────────
router.post('/fuel-waste', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const fuelLogs = await pool.query(`
      SELECT f.*, v.make, v.model, v.license_plate, d.name as driver_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      ORDER BY f.date DESC LIMIT 50
    `);
    const trips = await pool.query('SELECT * FROM trips ORDER BY start_time DESC LIMIT 50').catch(() => ({ rows: [] }));

    const systemPrompt = 'You are a fuel-waste detection AI. Respond with valid JSON only.';
    const prompt = `Analyze idling time, route deviations, and unusual fuel consumption.

Fuel Logs: ${JSON.stringify(fuelLogs.rows, null, 2)}
Trips: ${JSON.stringify(trips.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "anomalies": [
    { "vehicle_id": 0, "vehicle_name": "string", "issue": "idling|deviation|mechanical|driver_behavior", "severity": "low|medium|high", "estimated_waste_gallons": 0, "estimated_cost_usd": 0, "diagnostic_hint": "string" }
  ],
  "total_estimated_waste_gallons": 0,
  "total_estimated_waste_usd": 0,
  "recommended_actions": ["string"]
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };
    await saveAIResult(req.user?.id, 'fuel-waste', { fuel_logs: fuelLogs.rows.length }, parsed);
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Fleet Carbon Tracker ───────────────────────────────────────────────────
router.post('/carbon-tracker', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const trips = await pool.query(`
      SELECT t.*, r.name as route_name, r.distance_miles, v.fuel_type
      FROM trips t
      LEFT JOIN routes r ON t.route_id = r.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      ORDER BY t.start_time DESC LIMIT 100
    `);
    const fuel = await pool.query(
      'SELECT vehicle_id, SUM(gallons) AS total_g FROM fuel_logs WHERE date >= CURRENT_DATE - INTERVAL \'90 days\' GROUP BY vehicle_id'
    );

    const systemPrompt = 'You are a fleet sustainability analyst. Respond with valid JSON only.';
    const prompt = `Estimate per-trip CO2 emissions and propose green alternatives.

Trips: ${JSON.stringify(trips.rows, null, 2)}
Fuel by vehicle (90 days): ${JSON.stringify(fuel.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "kpis": {
    "total_co2_kg": 0,
    "co2_per_mile_kg": 0,
    "highest_emitter_vehicle_id": 0,
    "highest_emitter_co2_kg": 0
  },
  "green_alternatives": [
    { "current_route": "string", "alternative": "string", "co2_savings_kg": 0, "feasibility": "low|medium|high" }
  ],
  "ev_roi_analysis": [
    { "vehicle_id": 0, "current_co2_kg": 0, "ev_replacement_co2_kg": 0, "annual_savings_usd": 0, "payback_years": 0 }
  ],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };
    await saveAIResult(req.user?.id, 'carbon-tracker', { trips: trips.rows.length }, parsed);
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Predictive Breakdown Prevention ───────────────────────────────────────
router.post('/breakdown-prevention', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const vehicles = await pool.query('SELECT * FROM vehicles ORDER BY mileage DESC LIMIT 100');
    const maint = await pool.query(`
      SELECT m.*, v.make, v.model FROM maintenance m
      JOIN vehicles v ON m.vehicle_id = v.id
      ORDER BY m.scheduled_date DESC LIMIT 200
    `);

    const systemPrompt = 'You are a predictive maintenance AI. Respond with valid JSON only.';
    const prompt = `Schedule proactive maintenance windows to minimize downtime.

Vehicles: ${JSON.stringify(vehicles.rows, null, 2)}
Maintenance history: ${JSON.stringify(maint.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "schedule": [
    { "vehicle_id": 0, "vehicle_name": "string", "component": "string", "predicted_failure_date": "YYYY-MM-DD", "recommended_service_window": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }, "downtime_hours": 0, "estimated_cost_usd": 0, "risk_avoided_usd": 0 }
  ],
  "total_estimated_savings_usd": 0,
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };
    await saveAIResult(req.user?.id, 'breakdown-prevention', { vehicles: vehicles.rows.length }, parsed);
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Partner Load Balancing ─────────────────────────────────────────────────
router.post(
  '/load-balancer',
  authenticateToken,
  aiRateLimiter,
  [body('shipments').isArray({ min: 1 }).withMessage('shipments must be a non-empty array')],
  validate,
  async (req, res) => {
    try {
      const { shipments } = req.body;
      const vehicles = await pool.query("SELECT * FROM vehicles WHERE status = 'active' LIMIT 50");
      const drivers = await pool.query("SELECT id, name, status FROM drivers WHERE status = 'active' LIMIT 50");

      const systemPrompt = 'You are a fleet load balancer AI. Respond with valid JSON only.';
      const prompt = `Match incoming shipments to optimal vehicle + driver combos.

Incoming Shipments: ${JSON.stringify(shipments, null, 2)}
Available Vehicles: ${JSON.stringify(vehicles.rows, null, 2)}
Available Drivers: ${JSON.stringify(drivers.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "assignments": [
    { "shipment_id": "string", "vehicle_id": 0, "driver_id": 0, "rationale": "string", "estimated_completion_hours": 0 }
  ],
  "unassigned_shipments": [{ "shipment_id": "string", "reason": "string" }],
  "fleet_utilization_pct": 0,
  "summary": "string"
}`;

      const response = await callOpenRouter(prompt, systemPrompt);
      const content = response?.choices?.[0]?.message?.content || '';
      const parsed = parseAIJson(content) || { raw_response: content };
      await saveAIResult(req.user?.id, 'load-balancer', { shipments: shipments.length }, parsed);
      res.json(parsed);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── Driver Wellness Monitor ────────────────────────────────────────────────
router.post(
  '/driver-wellness',
  authenticateToken,
  aiRateLimiter,
  [body('driver_id').optional().isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      const { driver_id } = req.body || {};
      const driverQ = driver_id
        ? 'SELECT * FROM drivers WHERE id = $1'
        : "SELECT * FROM drivers WHERE status = 'active' ORDER BY id ASC LIMIT 50";
      const driverParams = driver_id ? [driver_id] : [];
      const drivers = await pool.query(driverQ, driverParams);
      const ids = drivers.rows.map((d) => d.id);

      const trips = ids.length ? await pool.query(
        `SELECT driver_id, COUNT(*) as trips,
                SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))/3600) as hours
         FROM trips WHERE driver_id = ANY($1) AND start_time > NOW() - INTERVAL '14 days'
         GROUP BY driver_id`,
        [ids]
      ) : { rows: [] };

      const safety = ids.length ? await pool.query(
        'SELECT driver_id, COUNT(*) as events FROM safety_events WHERE driver_id = ANY($1) AND date > NOW() - INTERVAL \'14 days\' GROUP BY driver_id',
        [ids]
      ) : { rows: [] };

      const systemPrompt = 'You are a fleet driver wellness AI. Respond with valid JSON only.';
      const prompt = `Identify fatigue risks before HOS violations.

Drivers: ${JSON.stringify(drivers.rows, null, 2)}
Trips (last 14 days): ${JSON.stringify(trips.rows, null, 2)}
Safety events (last 14 days): ${JSON.stringify(safety.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "wellness_assessments": [
    { "driver_id": 0, "name": "string", "fatigue_risk": "low|medium|high|critical", "hours_last_14_days": 0, "rest_deficit_hours": 0, "recommended_rest_hours": 0, "concerns": ["string"], "recommended_action": "string" }
  ],
  "fleet_overall_risk": "low|medium|high|critical",
  "immediate_actions": ["string"]
}`;

      const response = await callOpenRouter(prompt, systemPrompt);
      const content = response?.choices?.[0]?.message?.content || '';
      const parsed = parseAIJson(content) || { raw_response: content };
      await saveAIResult(req.user?.id, 'driver-wellness', { drivers: drivers.rows.length }, parsed);
      res.json(parsed);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── Cost Allocation Optimizer ──────────────────────────────────────────────
router.post('/cost-allocation', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const trips = await pool.query(`
      SELECT t.id, t.distance_miles, t.start_time, t.end_time,
             r.name as route_name, v.make, v.model
      FROM trips t
      LEFT JOIN routes r ON t.route_id = r.id
      LEFT JOIN vehicles v ON t.vehicle_id = v.id
      ORDER BY t.start_time DESC LIMIT 100
    `);
    const fuelByRoute = await pool.query(`
      SELECT r.name as route_name, SUM(f.cost) as fuel_cost, AVG(f.mpg) as avg_mpg, COUNT(*) as trips
      FROM fuel_logs f LEFT JOIN routes r ON f.route_id = r.id
      WHERE f.date >= CURRENT_DATE - INTERVAL '90 days'
      GROUP BY r.name
    `);

    const systemPrompt = 'You are a fleet cost analyst. Respond with valid JSON only.';
    const prompt = `Compute per-trip fuel + labor + wear and propose rate/margin rebalancing.

Trips: ${JSON.stringify(trips.rows, null, 2)}
Fuel cost by route (90 days): ${JSON.stringify(fuelByRoute.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "route_profitability": [
    { "route_name": "string", "trips": 0, "fuel_cost_usd": 0, "estimated_labor_usd": 0, "wear_usd": 0, "current_revenue_usd": 0, "margin_pct": 0, "recommended_rate_change_pct": 0 }
  ],
  "underperforming_routes": ["string"],
  "top_performing_routes": ["string"],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };
    await saveAIResult(req.user?.id, 'cost-allocation', { trips: trips.rows.length }, parsed);
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NEW: Fuel Fraud Detection ──────────────────────────────────────────────
router.post('/fuel-fraud', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const fuelLogs = await pool.query(`
      SELECT f.*, v.make, v.model, v.license_plate, v.fuel_type,
             d.name as driver_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      ORDER BY f.date DESC LIMIT 100
    `);
    const trips = await pool.query(`
      SELECT t.vehicle_id, t.driver_id, t.start_time, t.end_time, t.status, t.distance_miles
      FROM trips t ORDER BY t.start_time DESC LIMIT 100
    `);

    const systemPrompt = 'You are a fleet fuel fraud detection AI. Respond with valid JSON only.';
    const prompt = `Cross-reference fuel logs against GPS trip data to detect potential fraud.

Fuel Logs: ${JSON.stringify(fuelLogs.rows, null, 2)}
Trip Data: ${JSON.stringify(trips.rows, null, 2)}

Look for:
- Fill-ups when vehicle was stationary (no active trip)
- Gallons exceeding typical tank capacity
- Same station fill-ups within 2 hours
- MPG anomalies suggesting fuel diversion

Respond ONLY with valid JSON:
{
  "fraud_flags": [
    {
      "fuel_log_id": 0,
      "vehicle_id": 0,
      "vehicle_name": "string",
      "driver_name": "string",
      "date": "string",
      "fraud_type": "stationary_fillup|tank_overflow|rapid_refill|mpg_anomaly",
      "fraud_probability_pct": 0,
      "evidence": "string",
      "estimated_loss_usd": 0
    }
  ],
  "total_suspected_fraud_usd": 0,
  "highest_risk_drivers": [{ "driver_name": "string", "risk_score": 0, "incidents": 0 }],
  "recommended_actions": ["string"],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };
    await saveAIResult(req.user?.id, 'fuel-fraud', { fuel_logs: fuelLogs.rows.length }, parsed);
    res.json(parsed);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NEW: Driver Burnout / Churn Prediction ─────────────────────────────────
router.post(
  '/driver-burnout',
  authenticateToken,
  aiRateLimiter,
  [body('driver_id').optional().isInt({ min: 1 })],
  validate,
  async (req, res) => {
    try {
      const { driver_id } = req.body || {};

      const driverQ = driver_id
        ? 'SELECT * FROM drivers WHERE id = $1'
        : "SELECT * FROM drivers WHERE status = 'active' LIMIT 30";
      const drivers = await pool.query(driverQ, driver_id ? [driver_id] : []);
      const ids = drivers.rows.map((d) => d.id);

      const trips = ids.length ? await pool.query(
        `SELECT driver_id,
                COUNT(*) as trip_count,
                SUM(EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time))/3600) as total_hours,
                ROUND(AVG(COALESCE(distance_miles,0))::numeric,1) as avg_miles_per_trip,
                MAX(start_time) as last_trip
         FROM trips WHERE driver_id = ANY($1) AND start_time > NOW() - INTERVAL '30 days'
         GROUP BY driver_id`,
        [ids]
      ) : { rows: [] };

      const safety = ids.length ? await pool.query(
        'SELECT driver_id, COUNT(*) as events, MAX(date) as last_event FROM safety_events WHERE driver_id = ANY($1) AND date > NOW() - INTERVAL \'30 days\' GROUP BY driver_id',
        [ids]
      ) : { rows: [] };

      const systemPrompt = 'You are a driver retention and wellness AI. Respond with valid JSON only.';
      const prompt = `Predict driver burnout and churn risk.

Drivers: ${JSON.stringify(drivers.rows, null, 2)}
Trip metrics (30d): ${JSON.stringify(trips.rows, null, 2)}
Safety events (30d): ${JSON.stringify(safety.rows, null, 2)}

Respond ONLY with valid JSON:
{
  "burnout_assessments": [
    {
      "driver_id": 0,
      "name": "string",
      "burnout_risk_pct": 0,
      "churn_risk": "low|medium|high|critical",
      "expected_departure_estimate": "string",
      "hours_last_30d": 0,
      "days_since_rest": 0,
      "key_stressors": ["string"],
      "recommended_interventions": ["string"]
    }
  ],
  "fleet_retention_risk": "low|medium|high|critical",
  "immediate_actions": ["string"],
  "cost_of_inaction_usd": 0,
  "summary": "string"
}`;

      const response = await callOpenRouter(prompt, systemPrompt);
      const content = response?.choices?.[0]?.message?.content || '';
      const parsed = parseAIJson(content) || { raw_response: content };
      await saveAIResult(req.user?.id, 'driver-burnout', { drivers: drivers.rows.length }, parsed);
      res.json(parsed);
    } catch (err) { res.status(500).json({ error: err.message }); }
  }
);

// ─── NEW: Cost-Per-Mile Intelligence Report ─────────────────────────────────
router.post('/cost-per-mile-report', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const data = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.make || ' ' || v.model AS vehicle_name,
        v.license_plate,
        v.fuel_type,
        v.mileage as total_odometer,
        ROUND(SUM(COALESCE(f.cost, 0))::numeric, 2) as fuel_cost_90d,
        ROUND(SUM(COALESCE(m.cost, 0))::numeric, 2) as maint_cost_90d,
        ROUND(SUM(COALESCE(t.distance_miles, 0))::numeric, 1) as miles_90d
      FROM vehicles v
      LEFT JOIN fuel_logs f ON f.vehicle_id = v.id AND f.date >= NOW() - INTERVAL '90 days'
      LEFT JOIN maintenance m ON m.vehicle_id = v.id AND m.scheduled_date >= NOW() - INTERVAL '90 days' AND m.status = 'completed'
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.start_time >= NOW() - INTERVAL '90 days'
      GROUP BY v.id, v.make, v.model, v.license_plate, v.fuel_type, v.mileage
      ORDER BY miles_90d DESC
    `);

    // Compute cost-per-mile client-side before sending to AI
    const enriched = data.rows.map((row) => ({
      ...row,
      total_cost_90d: parseFloat(row.fuel_cost_90d || 0) + parseFloat(row.maint_cost_90d || 0),
      cost_per_mile: row.miles_90d > 0
        ? Math.round(((parseFloat(row.fuel_cost_90d || 0) + parseFloat(row.maint_cost_90d || 0)) / parseFloat(row.miles_90d)) * 1000) / 1000
        : null,
    }));

    const systemPrompt = 'You are a fleet financial analyst. Respond with valid JSON only.';
    const prompt = `Analyze fleet cost-per-mile and identify optimization opportunities.

Vehicle cost data (last 90 days): ${JSON.stringify(enriched, null, 2)}

Respond ONLY with valid JSON:
{
  "fleet_avg_cost_per_mile": 0,
  "best_performing_vehicle": { "vehicle_name": "string", "cost_per_mile": 0 },
  "worst_performing_vehicle": { "vehicle_name": "string", "cost_per_mile": 0, "root_cause": "string" },
  "vehicles_above_benchmark": [{ "vehicle_name": "string", "cost_per_mile": 0, "excess_pct": 0, "recommendation": "string" }],
  "fuel_type_comparison": [{ "fuel_type": "string", "avg_cost_per_mile": 0, "vehicle_count": 0 }],
  "annual_savings_if_optimized_usd": 0,
  "recommendations": [{ "action": "string", "expected_savings_usd": 0, "difficulty": "easy|medium|hard" }],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };
    await saveAIResult(req.user?.id, 'cost-per-mile-report', { vehicles: data.rows.length }, parsed);
    res.json({ vehicle_data: enriched, ai_analysis: parsed, timestamp: new Date().toISOString() });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── NEW: Fleet Summary Report (multi-domain executive report) ──────────────
router.post('/fleet-summary-report', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const [vehicles, drivers, fuel, safety, maintenance, trips] = await Promise.all([
      pool.query('SELECT COUNT(*) as total, COUNT(CASE WHEN status=\'active\' THEN 1 END) as active FROM vehicles'),
      pool.query('SELECT COUNT(*) as total, ROUND(AVG(safety_score)::numeric,1) as avg_score, COUNT(CASE WHEN status=\'active\' THEN 1 END) as active FROM drivers'),
      pool.query('SELECT ROUND(SUM(cost)::numeric,2) as cost_30d, ROUND(AVG(mpg)::numeric,1) as avg_mpg FROM fuel_logs WHERE date >= CURRENT_DATE - INTERVAL \'30 days\''),
      pool.query('SELECT COUNT(*) as events_30d, COUNT(CASE WHEN severity=\'critical\' THEN 1 END) as critical FROM safety_events WHERE date >= NOW() - INTERVAL \'30 days\''),
      pool.query('SELECT COUNT(*) as scheduled, ROUND(SUM(COALESCE(cost,0))::numeric,2) as pending_cost FROM maintenance WHERE status=\'scheduled\''),
      pool.query('SELECT COUNT(*) as trips_30d, ROUND(SUM(COALESCE(distance_miles,0))::numeric,1) as miles_30d FROM trips WHERE start_time >= NOW() - INTERVAL \'30 days\''),
    ]);

    const fleetData = {
      vehicles: vehicles.rows[0],
      drivers: drivers.rows[0],
      fuel_30d: fuel.rows[0],
      safety_30d: safety.rows[0],
      maintenance: maintenance.rows[0],
      trips_30d: trips.rows[0],
    };

    const systemPrompt = 'You are a fleet management executive AI advisor. Produce a comprehensive fleet summary report. Always respond with valid JSON only.';
    const prompt = `Generate a comprehensive executive fleet summary report.

Fleet Data: ${JSON.stringify(fleetData, null, 2)}

Respond ONLY with valid JSON:
{
  "executive_summary": "string",
  "fleet_health_score": 0,
  "health_grade": "A|B|C|D|F",
  "domain_scores": {
    "safety": { "score": 0, "status": "excellent|good|fair|poor", "key_issue": "string" },
    "fuel_efficiency": { "score": 0, "status": "excellent|good|fair|poor", "key_issue": "string" },
    "maintenance": { "score": 0, "status": "excellent|good|fair|poor", "key_issue": "string" },
    "driver_performance": { "score": 0, "status": "excellent|good|fair|poor", "key_issue": "string" }
  },
  "top_3_priorities": [
    { "priority": 1, "action": "string", "urgency": "immediate|this_week|this_month", "estimated_impact_usd": 0 }
  ],
  "cost_summary": {
    "monthly_fuel_usd": 0,
    "pending_maintenance_usd": 0,
    "estimated_monthly_total_usd": 0,
    "cost_per_active_vehicle_usd": 0
  },
  "risk_flags": ["string"],
  "thirty_day_outlook": "string",
  "recommended_kpis_to_watch": ["string"],
  "summary": "string"
}`;

    const response = await callOpenRouter(prompt, systemPrompt);
    const content = response?.choices?.[0]?.message?.content || '';
    const parsed = parseAIJson(content) || { raw_response: content };

    await saveAIResult(req.user?.id, 'fleet-summary-report', fleetData, parsed);

    res.json({
      ...parsed,
      fleet_data: fleetData,
      model: response?.model,
      usage: response?.usage,
      timestamp: new Date().toISOString(),
      category: 'fleet_summary',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── GET /history — paginated AI run history ────────────────────────────────
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const userId = req.user?.id;
    const typeFilter = req.query.type;

    const conditions = ['user_id = $1'];
    const params = [userId];
    if (typeFilter) { conditions.push(`analysis_type = $${params.length + 1}`); params.push(typeFilter); }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;
    const countR = await pool.query(`SELECT COUNT(*) FROM ai_results ${whereClause}`, params);
    const total = parseInt(countR.rows[0].count);

    const queryParams = [...params, limit, offset];
    const r = await pool.query(
      `SELECT id, analysis_type, input_data, result, created_at FROM ai_results ${whereClause} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      queryParams
    );
    res.json({ data: r.rows, pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ─── Apply pass 5 backlog (additive) ───────────────────────────────────────
// Each integration gates on its own env var and returns 503 + missing.
// In-memory streaming anomaly cache is a TOO-RISKY stub — additive only.

// Helper: 503 gate with explicit `missing: ENV_NAME` field.
function requireEnv(res, envName) {
  if (!process.env[envName]) {
    res.status(503).json({
      error: `Integration unavailable: ${envName} not configured`,
      missing: envName,
    });
    return false;
  }
  return true;
}

// In-memory streaming anomaly buffer (TOO-RISKY → in-memory stub only).
// Persisting to DB requires a streaming pipeline (Kafka/Kinesis) — out of scope.
const streamBuffer = new Map(); // vehicleId -> array of recent samples
const STREAM_BUFFER_MAX = 200;

function pushStreamSample(vehicleId, sample) {
  const arr = streamBuffer.get(vehicleId) || [];
  arr.push({ ...sample, ts: sample.ts || new Date().toISOString() });
  while (arr.length > STREAM_BUFFER_MAX) arr.shift();
  streamBuffer.set(vehicleId, arr);
  return arr;
}

// POST /api/ai/telematics-stream — push a single telematics sample.
// TOO-RISKY: in-memory only (server restart drops buffer). Additive endpoint.
router.post('/telematics-stream', authenticateToken, async (req, res) => {
  try {
    const { vehicle_id, speed, rpm, brake_pressure, lat, lng, ts } = req.body || {};
    if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id required' });
    const arr = pushStreamSample(vehicle_id, { speed, rpm, brake_pressure, lat, lng, ts });
    // Lightweight rule-based anomaly hint (no AI, no external deps).
    const anomalies = [];
    if (typeof speed === 'number' && speed > 95) anomalies.push({ type: 'overspeed', severity: 'high', value: speed });
    if (typeof rpm === 'number' && rpm > 5500) anomalies.push({ type: 'over_rev', severity: 'medium', value: rpm });
    if (typeof brake_pressure === 'number' && brake_pressure > 90) anomalies.push({ type: 'hard_brake', severity: 'medium', value: brake_pressure });
    res.json({ buffered: arr.length, anomalies, mode: 'in_memory' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/ai/telematics-stream/:vehicleId — recent buffered samples.
router.get('/telematics-stream/:vehicleId', authenticateToken, async (req, res) => {
  const arr = streamBuffer.get(req.params.vehicleId) || [];
  res.json({ vehicle_id: req.params.vehicleId, samples: arr, count: arr.length, mode: 'in_memory' });
});

// POST /api/ai/obd-import — OBD-II vehicle adapter integration.
// NEEDS-CREDS — env: OBD_API_URL, OBD_API_KEY (vendor-specific).
router.post('/obd-import', authenticateToken, aiRateLimiter, async (req, res) => {
  if (!requireEnv(res, 'OBD_API_KEY')) return;
  if (!requireEnv(res, 'OBD_API_URL')) return;
  // NEEDS-CREDS: vendor APIs vary (Geotab GO, ELM327 cloud, etc.).
  // When configured, the implementation should pull DTCs from
  // `${OBD_API_URL}/vehicles/{id}/dtcs` using OBD_API_KEY.
  res.json({ status: 'configured', message: 'OBD integration is configured. Implementation deferred to vendor-specific adapter.' });
});

// POST /api/ai/eld-compliance — DOT-certified ELD vendor integration.
// NEEDS-CREDS — env: ELD_VENDOR_API_KEY, ELD_VENDOR_API_URL.
router.post('/eld-compliance', authenticateToken, aiRateLimiter, async (req, res) => {
  if (!requireEnv(res, 'ELD_VENDOR_API_KEY')) return;
  if (!requireEnv(res, 'ELD_VENDOR_API_URL')) return;
  // NEEDS-CREDS: requires DOT-certified ELD vendor account (KeepTruckin/Motive,
  // Samsara, Omnitracs, etc.). Each has different OAuth + endpoint contracts.
  res.json({ status: 'configured', message: 'ELD compliance integration is configured.' });
});

// POST /api/ai/samsara-sync — Samsara fleet API integration.
// NEEDS-CREDS — env: SAMSARA_API_TOKEN.
router.post('/samsara-sync', authenticateToken, aiRateLimiter, async (req, res) => {
  if (!requireEnv(res, 'SAMSARA_API_TOKEN')) return;
  // NEEDS-CREDS: Samsara API base https://api.samsara.com/fleet/vehicles.
  res.json({ status: 'configured', message: 'Samsara integration ready.' });
});

// POST /api/ai/geotab-sync — Geotab fleet API integration.
// NEEDS-CREDS — env: GEOTAB_USERNAME, GEOTAB_PASSWORD, GEOTAB_DATABASE, GEOTAB_SERVER.
router.post('/geotab-sync', authenticateToken, aiRateLimiter, async (req, res) => {
  if (!requireEnv(res, 'GEOTAB_USERNAME')) return;
  if (!requireEnv(res, 'GEOTAB_PASSWORD')) return;
  if (!requireEnv(res, 'GEOTAB_DATABASE')) return;
  if (!requireEnv(res, 'GEOTAB_SERVER')) return;
  // NEEDS-CREDS: Geotab uses MyGeotab JSON-RPC: https://{server}/apiv1.
  res.json({ status: 'configured', message: 'Geotab integration ready.' });
});

// POST /api/ai/fleet-complete-sync — Fleet Complete API integration.
// NEEDS-CREDS — env: FLEET_COMPLETE_API_KEY.
router.post('/fleet-complete-sync', authenticateToken, aiRateLimiter, async (req, res) => {
  if (!requireEnv(res, 'FLEET_COMPLETE_API_KEY')) return;
  // NEEDS-CREDS: Fleet Complete REST API.
  res.json({ status: 'configured', message: 'Fleet Complete integration ready.' });
});

// POST /api/ai/autonomous-readiness — score a vehicle's readiness for autonomy.
// PRODUCT-DECISION: scoring weights below are a *reasonable default* drawn
// from SAE J3016 levels mapped to telematics signals (sensor coverage, MPG
// stability, driver-coaching score, breakdown rate, geofence compliance).
// Adjust weights once product confirms their L2/L3/L4 deployment targets.
router.post('/autonomous-readiness', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    // PRODUCT-DECISION: weights below — placeholder until product spec lands.
    const weights = {
      sensor_coverage: 0.30,
      breakdown_rate: 0.25,
      mpg_stability: 0.15,
      driver_coaching: 0.15,
      geofence_compliance: 0.15,
    };
    const { vehicle_id } = req.body || {};
    if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id required' });

    // Pull pre-existing data — best-effort only.
    let breakdowns = 0, fuelStdDev = 0, coachingAvg = 0;
    try {
      const r = await pool.query('SELECT COUNT(*)::int AS n FROM maintenance_records WHERE vehicle_id = $1', [vehicle_id]);
      breakdowns = r.rows[0]?.n || 0;
    } catch {}
    try {
      const r = await pool.query('SELECT STDDEV(mpg) AS s FROM fuel_logs WHERE vehicle_id = $1', [vehicle_id]);
      fuelStdDev = parseFloat(r.rows[0]?.s) || 0;
    } catch {}

    // Each sub-score is normalised to 0..1 (heuristic).
    const sub = {
      sensor_coverage: 0.6, // PRODUCT-DECISION: requires asset registry; default
      breakdown_rate: Math.max(0, 1 - breakdowns / 10),
      mpg_stability: Math.max(0, 1 - fuelStdDev / 5),
      driver_coaching: 0.6, // PRODUCT-DECISION: avg coaching score not yet tracked
      geofence_compliance: 0.7, // PRODUCT-DECISION: needs geofence violation table
    };
    let composite = 0;
    for (const k of Object.keys(weights)) composite += weights[k] * (sub[k] ?? 0);

    const sae_level =
      composite >= 0.85 ? 'L4' :
      composite >= 0.70 ? 'L3' :
      composite >= 0.55 ? 'L2' : 'L0/L1';

    res.json({
      vehicle_id,
      composite_score: Number(composite.toFixed(3)),
      sub_scores: sub,
      weights,
      sae_level_estimate: sae_level,
      product_decision_note: 'Default weights — adjust once product specs autonomy targets',
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
