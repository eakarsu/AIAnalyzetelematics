const express = require('express');
const https = require('https');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

function callOpenRouter(prompt) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-4.5',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
    });

    const options = {
      hostname: 'openrouter.ai',
      path: '/api/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'FleetIQ Telematics',
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
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

    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// AI Route Optimization
router.post('/optimize-route', authenticateToken, async (req, res) => {
  try {
    const routes = await pool.query('SELECT * FROM routes ORDER BY id LIMIT 10');
    const fuelData = await pool.query(`
      SELECT r.name, AVG(f.mpg) as avg_mpg, SUM(f.gallons) as total_gallons, COUNT(*) as trips
      FROM fuel_logs f JOIN routes r ON f.route_id = r.id GROUP BY r.name
    `);

    const prompt = `You are a fleet route optimization AI. Analyze this route and fuel data and provide optimization recommendations.

Routes: ${JSON.stringify(routes.rows)}
Fuel Data by Route: ${JSON.stringify(fuelData.rows)}

Provide a detailed analysis with:
1. Top 3 routes that need optimization and why
2. Specific recommendations for each (time of day, alternate paths, consolidation)
3. Estimated fuel savings percentage for each recommendation
4. Priority ranking (critical/high/medium/low)

Format as structured analysis with clear sections.`;

    const response = await callOpenRouter(prompt);
    const content = response.choices?.[0]?.message?.content || 'No response generated';
    res.json({
      analysis: content,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
      category: 'route_optimization'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Fuel Analysis
router.post('/analyze-fuel', authenticateToken, async (req, res) => {
  try {
    const fuelData = await pool.query(`
      SELECT f.*, v.make, v.model, v.fuel_type, v.license_plate, d.name as driver_name, r.name as route_name
      FROM fuel_logs f
      LEFT JOIN vehicles v ON f.vehicle_id = v.id
      LEFT JOIN drivers d ON f.driver_id = d.id
      LEFT JOIN routes r ON f.route_id = r.id
      ORDER BY f.date DESC LIMIT 20
    `);

    const prompt = `You are a fleet fuel efficiency analyst AI. Analyze this fuel consumption data comprehensively.

Fuel Log Data: ${JSON.stringify(fuelData.rows)}

Provide:
1. Overall fleet fuel efficiency assessment
2. Identify top 3 vehicles with worst fuel efficiency and root causes
3. Cost optimization opportunities with estimated dollar savings
4. Environmental impact analysis (CO2 reduction potential)
5. Actionable recommendations ranked by impact
6. Comparison between electric and diesel vehicles if applicable

Format as a professional fleet management report.`;

    const response = await callOpenRouter(prompt);
    const content = response.choices?.[0]?.message?.content || 'No response generated';
    res.json({
      analysis: content,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
      category: 'fuel_analysis'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Driver Behavior Analysis
router.post('/analyze-drivers', authenticateToken, async (req, res) => {
  try {
    const drivers = await pool.query('SELECT * FROM drivers ORDER BY safety_score ASC LIMIT 16');
    const safetyEvents = await pool.query(`
      SELECT s.*, d.name as driver_name FROM safety_events s
      JOIN drivers d ON s.driver_id = d.id ORDER BY s.date DESC LIMIT 20
    `);

    const prompt = `You are a driver safety and behavior analyst AI. Analyze driver performance and safety data.

Driver Data: ${JSON.stringify(drivers.rows)}
Recent Safety Events: ${JSON.stringify(safetyEvents.rows)}

Provide:
1. Driver risk assessment - categorize each driver (low/medium/high risk)
2. Pattern analysis - common unsafe behaviors and when they occur
3. Training recommendations for specific drivers
4. Fatigue risk analysis based on driving patterns
5. Top performers to recognize
6. Predicted safety score trends for next 30 days
7. Immediate actions needed for critical safety concerns

Format as a professional driver safety report.`;

    const response = await callOpenRouter(prompt);
    const content = response.choices?.[0]?.message?.content || 'No response generated';
    res.json({
      analysis: content,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
      category: 'driver_analysis'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Predictive Maintenance
router.post('/predict-maintenance', authenticateToken, async (req, res) => {
  try {
    const vehicles = await pool.query('SELECT * FROM vehicles ORDER BY mileage DESC');
    const maintenance = await pool.query(`
      SELECT m.*, v.make, v.model, v.mileage, v.license_plate
      FROM maintenance m JOIN vehicles v ON m.vehicle_id = v.id ORDER BY m.scheduled_date
    `);

    const prompt = `You are a predictive maintenance AI for a commercial fleet. Analyze vehicle and maintenance data.

Vehicle Fleet: ${JSON.stringify(vehicles.rows)}
Maintenance History: ${JSON.stringify(maintenance.rows)}

Provide:
1. Vehicles most likely to need unscheduled maintenance in next 30 days
2. Cost forecast for upcoming maintenance (next 60 days)
3. Optimal maintenance scheduling to minimize downtime
4. Parts that should be pre-ordered based on patterns
5. Vehicles that should be considered for retirement
6. ROI analysis of preventive vs reactive maintenance
7. Specific component failure predictions with probability percentages

Format as a professional maintenance planning report.`;

    const response = await callOpenRouter(prompt);
    const content = response.choices?.[0]?.message?.content || 'No response generated';
    res.json({
      analysis: content,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
      category: 'predictive_maintenance'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI Fleet Insights (General)
router.post('/fleet-insights', authenticateToken, async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM vehicles) as total_vehicles,
        (SELECT COUNT(*) FROM vehicles WHERE status = 'active') as active_vehicles,
        (SELECT COUNT(*) FROM drivers) as total_drivers,
        (SELECT COUNT(*) FROM trips WHERE status = 'in_progress') as active_trips,
        (SELECT COUNT(*) FROM alerts WHERE is_read = false) as unread_alerts,
        (SELECT COUNT(*) FROM maintenance WHERE status = 'scheduled') as pending_maintenance,
        (SELECT AVG(safety_score) FROM drivers) as avg_safety_score,
        (SELECT SUM(cost) FROM fuel_logs WHERE date >= CURRENT_DATE - INTERVAL '30 days') as monthly_fuel_cost
    `);
    const insights = await pool.query('SELECT * FROM ai_insights ORDER BY created_at DESC LIMIT 10');

    const prompt = `You are a fleet management executive AI advisor. Provide a comprehensive fleet health report.

Fleet Statistics: ${JSON.stringify(stats.rows[0])}
Recent AI Insights: ${JSON.stringify(insights.rows)}

Provide:
1. Executive summary of fleet health (1-2 paragraphs)
2. Key performance indicators with status (good/warning/critical)
3. Top 5 action items ranked by urgency and business impact
4. Cost optimization opportunities with estimated savings
5. Sustainability metrics and improvement targets
6. 30-day outlook and risk factors
7. Competitive benchmarking recommendations

Format as an executive briefing report.`;

    const response = await callOpenRouter(prompt);
    const content = response.choices?.[0]?.message?.content || 'No response generated';
    res.json({
      analysis: content,
      model: response.model,
      usage: response.usage,
      timestamp: new Date().toISOString(),
      category: 'fleet_insights'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dashboard Stats
router.get('/dashboard-stats', authenticateToken, async (req, res) => {
  try {
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
    res.json(stats.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
