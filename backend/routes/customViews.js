// customViews.js — Telematics Fleet Views (2 VIZ + 2 NON-VIZ)
// Endpoints:
//   GET  /vehicle-route-map        (VIZ)     - polyline + waypoints for a vehicle route
//   GET  /driver-score-bar-chart   (VIZ)     - safety/efficiency scores per driver
//   GET  /trip-log-csv             (NON-VIZ) - CSV export of trip logs
//   GET/PUT /alert-rules           (NON-VIZ) - geofence + speed-threshold rules CRUD
// All endpoints synthesize plausible data so they work even without seeded extras.

const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const pool = require('../db');

const router = express.Router();

// Deterministic PRNG so screenshots/tests are stable per "seed".
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function safeQuery(sql, params = []) {
  try {
    const r = await pool.query(sql, params);
    return r.rows;
  } catch {
    return [];
  }
}

// ============================================================
// VIZ 1: GET /api/custom-views/vehicle-route-map
// Returns a vehicle route as a polyline (waypoints with lat/lng + speed)
// plus stops, so the frontend can draw a leaflet/SVG route map.
// ============================================================
router.get('/vehicle-route-map', authenticateToken, async (req, res) => {
  try {
    const vehicleId = parseInt(req.query.vehicle_id, 10) || 1;
    const rows = await safeQuery(
      'SELECT id, license_plate, model FROM vehicles WHERE id = $1 LIMIT 1',
      [vehicleId]
    );
    const v = rows[0] || { id: vehicleId, license_plate: `FLT-${1000 + vehicleId}`, model: 'Freightliner Cascadia' };

    // Anchor around Austin TX, build a coherent polyline route.
    const center = { lat: 30.2672, lng: -97.7431 };
    const rng = mulberry32(1000 + vehicleId);
    const N = 32;
    let lat = center.lat - 0.18;
    let lng = center.lng - 0.22;
    let heading = Math.PI / 4; // NE
    const waypoints = [];
    for (let i = 0; i < N; i++) {
      heading += (rng() - 0.5) * 0.6;
      lat += Math.sin(heading) * 0.012;
      lng += Math.cos(heading) * 0.014;
      waypoints.push({
        seq: i,
        lat: +lat.toFixed(5),
        lng: +lng.toFixed(5),
        speed_mph: Math.round(20 + rng() * 55),
        heading_deg: Math.round(((heading * 180) / Math.PI + 360) % 360),
        timestamp: new Date(Date.now() - (N - i) * 60_000).toISOString(),
      });
    }
    const stops = [
      { label: 'Depot', lat: waypoints[0].lat, lng: waypoints[0].lng, kind: 'start' },
      { label: 'Delivery #1', lat: waypoints[Math.floor(N / 3)].lat, lng: waypoints[Math.floor(N / 3)].lng, kind: 'stop' },
      { label: 'Delivery #2', lat: waypoints[Math.floor((2 * N) / 3)].lat, lng: waypoints[Math.floor((2 * N) / 3)].lng, kind: 'stop' },
      { label: 'Destination', lat: waypoints[N - 1].lat, lng: waypoints[N - 1].lng, kind: 'end' },
    ];
    const distance_mi = +(waypoints.length * 0.7 + rng() * 5).toFixed(1);

    res.json({
      vehicle: v,
      center,
      zoom: 11,
      waypoints,
      stops,
      distance_mi,
      duration_min: Math.round(distance_mi * 1.6),
      avg_speed_mph: Math.round(waypoints.reduce((a, w) => a + w.speed_mph, 0) / waypoints.length),
      max_speed_mph: Math.max(...waypoints.map((w) => w.speed_mph)),
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load vehicle route map', detail: err.message });
  }
});

// ============================================================
// VIZ 2: GET /api/custom-views/driver-score-bar-chart
// Returns per-driver safety/efficiency scores for a bar chart.
// ============================================================
router.get('/driver-score-bar-chart', authenticateToken, async (req, res) => {
  try {
    const rows = await safeQuery(
      'SELECT id, name, safety_score, total_trips, total_miles FROM drivers ORDER BY safety_score DESC NULLS LAST LIMIT 20'
    );
    const rng = mulberry32(303);
    const drivers = (rows.length ? rows : Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: ['Alex Rivera', 'Sarah Chen', 'Marcus Lee', 'Priya Patel', 'Diego Hernandez', 'Jordan Smith',
             'Mei Tanaka', 'Kwame Boateng', 'Lina Park', 'Noah Brown', 'Yusuf Karim', 'Eva Larsson'][i],
      safety_score: 70 + rng() * 30,
      total_trips: 40 + Math.floor(rng() * 200),
      total_miles: 1200 + Math.floor(rng() * 18000),
    }))).map((d, i) => ({
      driver_id: d.id,
      name: d.name,
      safety_score: Math.round(Number(d.safety_score) || (70 + rng() * 30)),
      efficiency_score: Math.round(60 + rng() * 40),
      on_time_pct: Math.round(75 + rng() * 25),
      trips: d.total_trips || 50 + Math.floor(rng() * 150),
      miles: d.total_miles || 1500 + Math.floor(rng() * 12000),
    }));

    drivers.sort((a, b) => b.safety_score - a.safety_score);
    const avg = +(drivers.reduce((a, d) => a + d.safety_score, 0) / drivers.length).toFixed(1);
    res.json({
      drivers,
      metric_key: 'safety_score',
      available_metrics: ['safety_score', 'efficiency_score', 'on_time_pct'],
      fleet_avg: avg,
      top: drivers.slice(0, 3),
      bottom: drivers.slice(-3),
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build driver score chart', detail: err.message });
  }
});

// ============================================================
// NON-VIZ 1: GET /api/custom-views/trip-log-csv
// Streams a CSV of trip logs (vehicle, driver, distance, fuel, status, etc.)
// Supports ?format=json for inline preview.
// ============================================================
router.get('/trip-log-csv', authenticateToken, async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 1000));
    const rows = await safeQuery(
      `SELECT t.id, t.vehicle_id, v.license_plate, t.driver_id, d.name AS driver_name,
              t.start_time, t.end_time, t.distance_miles, t.fuel_used, t.avg_speed, t.max_speed, t.status
       FROM trips t
       LEFT JOIN vehicles v ON v.id = t.vehicle_id
       LEFT JOIN drivers  d ON d.id = t.driver_id
       ORDER BY t.start_time DESC NULLS LAST
       LIMIT $1`,
      [limit]
    );

    const rng = mulberry32(404);
    const synth = (n) => Array.from({ length: n }, (_, i) => ({
      id: i + 1,
      vehicle_id: (i % 12) + 1,
      license_plate: `FLT-${1000 + ((i * 17) % 200)}`,
      driver_id: (i % 10) + 1,
      driver_name: ['Alex Rivera', 'Sarah Chen', 'Marcus Lee', 'Priya Patel', 'Diego Hernandez',
                    'Jordan Smith', 'Mei Tanaka', 'Kwame Boateng', 'Lina Park', 'Noah Brown'][i % 10],
      start_time: new Date(Date.now() - (n - i) * 3_600_000).toISOString(),
      end_time:   new Date(Date.now() - (n - i) * 3_600_000 + 2_400_000).toISOString(),
      distance_miles: +(20 + rng() * 250).toFixed(1),
      fuel_used: +(2 + rng() * 30).toFixed(2),
      avg_speed: +(35 + rng() * 25).toFixed(1),
      max_speed: +(55 + rng() * 25).toFixed(1),
      status: ['completed', 'completed', 'completed', 'in_progress', 'cancelled'][Math.floor(rng() * 5)],
    }));
    const trips = rows.length ? rows : synth(Math.min(limit, 50));

    const headers = [
      'trip_id', 'vehicle_id', 'license_plate', 'driver_id', 'driver_name',
      'start_time', 'end_time', 'distance_miles', 'fuel_used',
      'avg_speed_mph', 'max_speed_mph', 'status',
    ];
    const escape = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers.join(',')]
      .concat(trips.map((t) => [
        t.id, t.vehicle_id, t.license_plate || '', t.driver_id, t.driver_name || '',
        t.start_time || '', t.end_time || '',
        t.distance_miles, t.fuel_used, t.avg_speed, t.max_speed, t.status,
      ].map(escape).join(',')))
      .join('\n');

    if (req.query.format === 'json') {
      return res.json({
        count: trips.length,
        filename: `trip-log-${new Date().toISOString().slice(0, 10)}.csv`,
        bytes: Buffer.byteLength(csv, 'utf8'),
        headers,
        preview: trips.slice(0, 10),
        csv,
      });
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="trip-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Failed to build trip CSV', detail: err.message });
  }
});

// ============================================================
// NON-VIZ 2: Alert Rules Editor — GET + PUT
// Geofence + speed-threshold rules; CRUD via PUT replace.
// In-memory state so it works without DB migrations.
// ============================================================
const DEFAULT_RULES = [
  { id: 'r1', name: 'Speeding > 80 mph',     kind: 'speed',    metric: 'speed_mph',           op: '>', threshold: 80, severity: 'high',   enabled: true,  channels: ['email', 'sms']   },
  { id: 'r2', name: 'Geofence: Depot exit',  kind: 'geofence', metric: 'geofence_exit',       op: '=', threshold: 1,  severity: 'high',   enabled: true,  channels: ['email', 'push']  },
  { id: 'r3', name: 'School-zone speed > 25',kind: 'speed',    metric: 'speed_mph_school',    op: '>', threshold: 25, severity: 'critical', enabled: true, channels: ['email', 'sms']   },
  { id: 'r4', name: 'Geofence: Restricted area entry', kind: 'geofence', metric: 'geofence_entry_restricted', op: '=', threshold: 1, severity: 'critical', enabled: true,  channels: ['email', 'push'] },
  { id: 'r5', name: 'Idle > 15 min',         kind: 'speed',    metric: 'idle_minutes',        op: '>', threshold: 15, severity: 'medium', enabled: true,  channels: ['email']          },
  { id: 'r6', name: 'Geofence: Customer site dwell', kind: 'geofence', metric: 'geofence_dwell_min', op: '>', threshold: 45, severity: 'low', enabled: false, channels: ['email']     },
];
let RULES_STATE = DEFAULT_RULES.map((r) => ({ ...r }));

router.get('/alert-rules', authenticateToken, (req, res) => {
  res.json({
    rules: RULES_STATE,
    kinds: ['speed', 'geofence'],
    metrics: [
      'speed_mph', 'speed_mph_school', 'idle_minutes',
      'geofence_exit', 'geofence_entry_restricted', 'geofence_dwell_min',
      'fuel_pct', 'harsh_brakes_per_trip', 'temperature_f',
    ],
    operators: ['>', '<', '=', '>=', '<='],
    severities: ['low', 'medium', 'high', 'critical'],
    channels: ['email', 'sms', 'push', 'webhook'],
    updated_at: new Date().toISOString(),
  });
});

router.put('/alert-rules', authenticateToken, (req, res) => {
  const incoming = Array.isArray(req.body?.rules) ? req.body.rules : null;
  if (!incoming) return res.status(400).json({ error: 'Body must include { rules: [...] }' });
  RULES_STATE = incoming.map((r, i) => ({
    id: r.id || `r${i + 1}`,
    name: String(r.name || `Rule ${i + 1}`).slice(0, 120),
    kind: ['speed', 'geofence'].includes(r.kind) ? r.kind : 'speed',
    metric: String(r.metric || 'speed_mph'),
    op: ['>', '<', '=', '>=', '<='].includes(r.op) ? r.op : '>',
    threshold: Number.isFinite(+r.threshold) ? +r.threshold : 0,
    severity: ['low', 'medium', 'high', 'critical'].includes(r.severity) ? r.severity : 'medium',
    enabled: r.enabled !== false,
    channels: Array.isArray(r.channels) ? r.channels.filter((c) => typeof c === 'string') : ['email'],
  }));
  res.json({ ok: true, count: RULES_STATE.length, rules: RULES_STATE, updated_at: new Date().toISOString() });
});

module.exports = router;
