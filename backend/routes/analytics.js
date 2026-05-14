const express = require('express');
const pool = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { callOpenRouter, parseAIJson, saveAIResult } = require('../lib/openrouter');
const router = express.Router();

// ─── Carbon Footprint Tracker ────────────────────────────────────────────────
router.get('/carbon-footprint', authenticateToken, async (req, res) => {
  try {
    const fuelResult = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.make || ' ' || v.model AS vehicle_name,
        v.license_plate,
        v.fuel_type,
        TO_CHAR(f.date, 'YYYY-MM') AS month,
        SUM(f.gallons) AS total_gallons,
        SUM(f.cost) AS total_cost,
        COUNT(*) AS fill_ups
      FROM fuel_logs f
      JOIN vehicles v ON f.vehicle_id = v.id
      WHERE f.date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY v.id, v.make, v.model, v.license_plate, v.fuel_type, TO_CHAR(f.date, 'YYYY-MM')
      ORDER BY month DESC, vehicle_name
    `);

    const CO2_PER_GALLON = { diesel: 22.4, gasoline: 19.6, electric: 0, hybrid: 19.6 };

    const rows = fuelResult.rows.map((row) => {
      const fuelType = (row.fuel_type || 'gasoline').toLowerCase();
      const lbsPerGallon = CO2_PER_GALLON[fuelType] ?? 19.6;
      const co2_lbs = parseFloat(row.total_gallons) * lbsPerGallon;
      const co2_tons = co2_lbs / 2000;
      return { ...row, co2_lbs: Math.round(co2_lbs * 10) / 10, co2_tons: Math.round(co2_tons * 1000) / 1000 };
    });

    const monthlyTotals = {};
    for (const row of rows) {
      if (!monthlyTotals[row.month]) {
        monthlyTotals[row.month] = { month: row.month, total_gallons: 0, co2_lbs: 0, co2_tons: 0 };
      }
      monthlyTotals[row.month].total_gallons += parseFloat(row.total_gallons);
      monthlyTotals[row.month].co2_lbs += row.co2_lbs;
      monthlyTotals[row.month].co2_tons += row.co2_tons;
    }

    const timeSeries = Object.values(monthlyTotals).sort((a, b) => a.month.localeCompare(b.month));
    const overallTotalCO2 = rows.reduce((sum, r) => sum + r.co2_lbs, 0);

    const systemPrompt = 'You are a fleet sustainability expert. Respond with valid JSON only.';
    const prompt = `Analyze this CO2 emissions data and recommend specific reduction strategies.

Total CO2 last 12 months: ${Math.round(overallTotalCO2)} lbs (${Math.round(overallTotalCO2 / 2000 * 10) / 10} tons)
Monthly Totals: ${JSON.stringify(timeSeries, null, 2)}
Vehicle Breakdown (top emitters): ${JSON.stringify(rows.slice(0, 10), null, 2)}

Respond ONLY with valid JSON:
{
  "trend": "improving|worsening|stable",
  "trend_pct_change": 0,
  "top_emitters": [{ "vehicle_id": 0, "vehicle_name": "string", "co2_lbs_12m": 0, "root_cause": "string" }],
  "reduction_strategies": [
    { "strategy": "string", "co2_reduction_lbs_6m": 0, "cost_usd": 0, "roi_months": 0 }
  ],
  "ev_switch_roi": [{ "vehicle_id": 0, "vehicle_name": "string", "annual_savings_usd": 0, "breakeven_months": 0 }],
  "industry_benchmark": { "avg_co2_per_vehicle_lbs_monthly": 0, "fleet_vs_benchmark": "above|below|at" },
  "offset_programs": ["string"],
  "summary": "string"
}`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);
    const aiContent = aiResponse?.choices?.[0]?.message?.content || '';
    const aiParsed = parseAIJson(aiContent) || { raw_response: aiContent };

    // Persist AI result (with user_id)
    await saveAIResult(req.user?.id, 'carbon-footprint', { months: timeSeries.length, total_co2_lbs: Math.round(overallTotalCO2) }, aiParsed);

    res.json({
      summary: {
        total_co2_lbs: Math.round(overallTotalCO2 * 10) / 10,
        total_co2_tons: Math.round(overallTotalCO2 / 2000 * 1000) / 1000,
        period: 'Last 12 months',
        vehicles_tracked: [...new Set(rows.map((r) => r.vehicle_id))].length,
      },
      time_series: timeSeries,
      vehicle_breakdown: rows,
      ai_analysis: aiParsed,
      model: aiResponse?.model,
      timestamp: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Maintenance Cost Trends ─────────────────────────────────────────────────
router.get('/maintenance-trends', authenticateToken, async (req, res) => {
  try {
    const maintenanceResult = await pool.query(`
      SELECT
        m.type AS component_type,
        TO_CHAR(m.scheduled_date, 'YYYY-MM') AS month,
        COUNT(*) AS record_count,
        SUM(COALESCE(m.cost, 0)) AS total_cost,
        AVG(COALESCE(m.cost, 0)) AS avg_cost,
        COUNT(CASE WHEN m.status = 'completed' THEN 1 END) AS completed_count,
        COUNT(CASE WHEN m.status = 'scheduled' THEN 1 END) AS scheduled_count
      FROM maintenance m
      WHERE m.scheduled_date >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY m.type, TO_CHAR(m.scheduled_date, 'YYYY-MM')
      ORDER BY month DESC, total_cost DESC
    `);

    const byComponent = {};
    for (const row of maintenanceResult.rows) {
      if (!byComponent[row.component_type]) {
        byComponent[row.component_type] = { component_type: row.component_type, total_cost: 0, total_records: 0, monthly: [] };
      }
      byComponent[row.component_type].total_cost += parseFloat(row.total_cost);
      byComponent[row.component_type].total_records += parseInt(row.record_count);
      byComponent[row.component_type].monthly.push({
        month: row.month,
        cost: parseFloat(row.total_cost),
        count: parseInt(row.record_count),
        avg_cost: Math.round(parseFloat(row.avg_cost) * 100) / 100,
      });
    }

    const componentList = Object.values(byComponent).sort((a, b) => b.total_cost - a.total_cost);

    const systemPrompt = 'You are a fleet maintenance cost analyst and predictor. Respond with valid JSON only.';
    const prompt = `Analyze this maintenance cost data.

Maintenance Cost Data by Component Type (last 12 months): ${JSON.stringify(componentList, null, 2)}

Respond ONLY with valid JSON:
{
  "rising_cost_components": [{ "component": "string", "mom_change_pct": 0, "trend": "rising|falling|stable" }],
  "root_cause_analysis": [{ "component": "string", "root_cause": "string", "evidence": "string" }],
  "three_month_cost_forecast": [{ "component": "string", "month1_usd": 0, "month2_usd": 0, "month3_usd": 0 }],
  "systemic_fleet_alerts": ["string"],
  "preventive_maintenance_changes": [{ "change": "string", "expected_savings_usd": 0 }],
  "roi_of_preventive_measures": { "total_investment_usd": 0, "expected_savings_usd": 0, "roi_pct": 0 },
  "summary": "string"
}`;

    const aiResponse = await callOpenRouter(prompt, systemPrompt);
    const aiContent = aiResponse?.choices?.[0]?.message?.content || '';
    const aiParsed = parseAIJson(aiContent) || { raw_response: aiContent };

    // Persist AI result (with user_id)
    await saveAIResult(req.user?.id, 'maintenance-trends', { components: componentList.length }, aiParsed);

    res.json({
      summary: {
        period: 'Last 12 months',
        total_cost: componentList.reduce((sum, c) => sum + c.total_cost, 0).toFixed(2),
        total_records: componentList.reduce((sum, c) => sum + c.total_records, 0),
        component_types: componentList.length,
      },
      by_component: componentList,
      raw_monthly: maintenanceResult.rows,
      ai_analysis: aiParsed,
      model: aiResponse?.model,
      timestamp: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Cost-Per-Mile Summary (pure SQL, no AI) ─────────────────────────────────
router.get('/cost-per-mile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.id as vehicle_id,
        v.make || ' ' || v.model AS vehicle_name,
        v.license_plate,
        v.fuel_type,
        ROUND(SUM(COALESCE(f.cost, 0))::numeric, 2) AS fuel_cost_90d,
        ROUND(SUM(COALESCE(m.cost, 0))::numeric, 2) AS maint_cost_90d,
        ROUND(SUM(COALESCE(t.distance_miles, 0))::numeric, 1) AS miles_90d,
        CASE WHEN SUM(COALESCE(t.distance_miles, 0)) > 0
          THEN ROUND(((SUM(COALESCE(f.cost,0)) + SUM(COALESCE(m.cost,0))) / SUM(COALESCE(t.distance_miles,0)))::numeric, 4)
          ELSE NULL
        END AS cost_per_mile
      FROM vehicles v
      LEFT JOIN fuel_logs f ON f.vehicle_id = v.id AND f.date >= NOW() - INTERVAL '90 days'
      LEFT JOIN maintenance m ON m.vehicle_id = v.id AND m.scheduled_date >= NOW() - INTERVAL '90 days' AND m.status = 'completed'
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.start_time >= NOW() - INTERVAL '90 days'
      GROUP BY v.id, v.make, v.model, v.license_plate, v.fuel_type
      ORDER BY cost_per_mile DESC NULLS LAST
    `);

    const validRows = result.rows.filter((r) => r.cost_per_mile !== null);
    const avgCpm = validRows.length
      ? Math.round(validRows.reduce((sum, r) => sum + parseFloat(r.cost_per_mile), 0) / validRows.length * 10000) / 10000
      : 0;

    res.json({
      data: result.rows,
      summary: {
        fleet_avg_cost_per_mile: avgCpm,
        vehicles_with_data: validRows.length,
        period: 'Last 90 days',
      },
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

// ─── Fleet Utilization Summary ───────────────────────────────────────────────
router.get('/fleet-utilization', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        v.status,
        COUNT(*) as vehicle_count,
        COUNT(CASE WHEN t.id IS NOT NULL THEN 1 END) as vehicles_with_trips_7d
      FROM vehicles v
      LEFT JOIN trips t ON t.vehicle_id = v.id AND t.start_time >= NOW() - INTERVAL '7 days'
      GROUP BY v.status
    `);

    const totalTrips = await pool.query(
      "SELECT COUNT(*) as cnt, SUM(distance_miles) as total_miles FROM trips WHERE start_time >= NOW() - INTERVAL '30 days'"
    );

    res.json({
      by_status: result.rows,
      monthly_trips: parseInt(totalTrips.rows[0].cnt),
      monthly_miles: parseFloat(totalTrips.rows[0].total_miles || 0),
      timestamp: new Date().toISOString(),
    });
  } catch (err) { res.status(500).json({ error: 'Internal server error' }); }
});

module.exports = router;
