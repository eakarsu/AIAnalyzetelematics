// Driver Score Bar Chart — SVG horizontal bars per driver with metric toggle.
import React, { useEffect, useState } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const METRIC_LABEL = {
  safety_score: 'Safety Score',
  efficiency_score: 'Efficiency Score',
  on_time_pct: 'On-Time %',
};

function barColor(v) {
  if (v >= 90) return '#22c55e';
  if (v >= 75) return '#3b82f6';
  if (v >= 60) return '#f59e0b';
  return '#ef4444';
}

export default function DriverScoreBarChart() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [metric, setMetric] = useState('safety_score');

  useEffect(() => {
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/custom-views/driver-score-bar-chart`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(setData)
      .catch((e) => setErr(e.message));
  }, []);

  if (err) return <div style={{ color: '#f87171' }}>Bar chart error: {err}</div>;
  if (!data) return <div style={{ color: '#94a3b8' }}>Loading driver scores...</div>;

  const sorted = [...data.drivers].sort((a, b) => b[metric] - a[metric]);
  const W = 720, ROW_H = 26, PAD_L = 160, PAD_R = 40, TOP = 40;
  const H = TOP + sorted.length * ROW_H + 20;
  const max = 100;
  const xFor = (v) => PAD_L + (v / max) * (W - PAD_L - PAD_R);

  return (
    <div data-testid="driver-score-bar-chart" style={{ background: '#0f172a', padding: 16, borderRadius: 12, border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h3 style={{ margin: 0, color: '#f1f5f9' }}>Driver Score Bar Chart</h3>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>
            {sorted.length} drivers — fleet avg {data.fleet_avg} — top: {data.top[0]?.name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {data.available_metrics.map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              data-testid={`metric-${m}`}
              style={{
                padding: '6px 12px',
                background: metric === m ? '#1d4ed8' : '#1e293b',
                color: '#f1f5f9',
                border: '1px solid ' + (metric === m ? '#3b82f6' : '#334155'),
                borderRadius: 4,
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              {METRIC_LABEL[m] || m}
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', background: '#020617', borderRadius: 8 }}>
        {/* gridlines */}
        {[0, 25, 50, 75, 100].map((g) => (
          <g key={g}>
            <line x1={xFor(g)} y1={TOP - 6} x2={xFor(g)} y2={H - 10} stroke="#1e293b" />
            <text x={xFor(g)} y={TOP - 10} fill="#64748b" fontSize="10" textAnchor="middle">{g}</text>
          </g>
        ))}
        {/* avg line */}
        <line x1={xFor(data.fleet_avg)} y1={TOP - 6} x2={xFor(data.fleet_avg)} y2={H - 10} stroke="#fbbf24" strokeDasharray="4 4" />
        <text x={xFor(data.fleet_avg) + 4} y={TOP - 12} fill="#fbbf24" fontSize="10">avg {data.fleet_avg}</text>

        {sorted.map((d, i) => {
          const y = TOP + i * ROW_H;
          const v = d[metric];
          const w = xFor(v) - PAD_L;
          return (
            <g key={d.driver_id}>
              <text x={PAD_L - 8} y={y + ROW_H / 2 + 4} fill="#cbd5e1" fontSize="11" textAnchor="end">{d.name}</text>
              <rect x={PAD_L} y={y + 4} width={w} height={ROW_H - 8} fill={barColor(v)} rx="3" />
              <text x={PAD_L + w + 6} y={y + ROW_H / 2 + 4} fill="#f1f5f9" fontSize="11">{v}</text>
            </g>
          );
        })}
      </svg>

      <div style={{ marginTop: 10, fontSize: 12, color: '#cbd5e1', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <span><strong>Top 3:</strong> {data.top.map((d) => `${d.name} (${d[metric]})`).join(', ')}</span>
        <span><strong>Bottom 3:</strong> {data.bottom.map((d) => `${d.name} (${d[metric]})`).join(', ')}</span>
      </div>
    </div>
  );
}
