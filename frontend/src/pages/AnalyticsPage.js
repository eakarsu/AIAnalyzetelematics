import React, { useState } from 'react';
import { api } from '../services/api';

const ANALYTICS_CONFIG = {
  'carbon-footprint': {
    fetch: () => api.carbonFootprint(),
    description: 'CO2 emissions tracked per vehicle per month with AI-powered reduction strategies.',
    dataKey: null, // custom render
  },
  'maintenance-trends': {
    fetch: () => api.maintenanceTrends(),
    description: 'Maintenance cost trends by component type with AI predictions for the next 3 months.',
    dataKey: null,
  },
  'cost-per-mile': {
    fetch: () => api.costPerMile(),
    description: 'Combined fuel + maintenance cost per mile per vehicle over the last 90 days.',
    dataKey: 'data',
  },
  'fleet-utilization': {
    fetch: () => api.fleetUtilization(),
    description: 'Fleet vehicle utilization rate — active vs idle vehicles over the last 7 and 30 days.',
    dataKey: null,
  },
};

function RenderValue({ value, depth = 0 }) {
  if (value === null || value === undefined) return <span style={{ color: '#94a3b8' }}>—</span>;

  if (Array.isArray(value)) {
    if (value.length === 0) return <span style={{ color: '#94a3b8' }}>(empty)</span>;
    if (typeof value[0] === 'object') {
      const cols = Object.keys(value[0]);
      return (
        <div style={{ overflowX: 'auto', marginTop: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {cols.map((c) => (
                  <th key={c} style={{ textAlign: 'left', padding: '8px 10px', background: '#1e293b', color: '#94a3b8', textTransform: 'uppercase', fontSize: 11, borderBottom: '1px solid #334155' }}>
                    {c.replace(/_/g, ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {value.map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                  {cols.map((c) => (
                    <td key={c} style={{ padding: '8px 10px', color: '#cbd5e1', verticalAlign: 'top' }}>
                      <RenderValue value={row[c]} depth={depth + 1} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    return <ul style={{ margin: 0, paddingLeft: 20 }}>{value.map((v, i) => <li key={i} style={{ color: '#cbd5e1', marginBottom: 4 }}><RenderValue value={v} depth={depth + 1} /></li>)}</ul>;
  }

  if (typeof value === 'object') {
    return (
      <div style={{ paddingLeft: depth > 0 ? 12 : 0, borderLeft: depth > 0 ? '2px solid #334155' : 'none' }}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 6 }}>
            <strong style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}: </strong>
            <RenderValue value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') return <span style={{ color: value ? '#22c55e' : '#ef4444' }}>{value ? 'Yes' : 'No'}</span>;
  if (typeof value === 'number') return <span style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{Number(value).toLocaleString()}</span>;
  return <span style={{ color: '#e2e8f0' }}>{String(value)}</span>;
}

export default function AnalyticsPage({ type, title }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const config = ANALYTICS_CONFIG[type];

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await config.fetch();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderResult = () => {
    if (!result) return null;

    if (type === 'carbon-footprint') {
      return (
        <div className="ai-result">
          <div className="ai-result-body" style={{ padding: 20 }}>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total CO2 (lbs)', value: result.summary?.total_co2_lbs?.toLocaleString() },
                { label: 'Total CO2 (tons)', value: result.summary?.total_co2_tons?.toLocaleString() },
                { label: 'Vehicles Tracked', value: result.summary?.vehicles_tracked },
                { label: 'Period', value: result.summary?.period },
              ].map((s) => (
                <div key={s.label} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{s.value ?? '—'}</div>
                </div>
              ))}
            </div>
            {result.ai_analysis && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: '#cbd5e1', marginBottom: 12 }}>AI Analysis</h3>
                <RenderValue value={result.ai_analysis} />
              </div>
            )}
            {result.vehicle_breakdown && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: '#cbd5e1', marginBottom: 12 }}>Vehicle Breakdown</h3>
                <RenderValue value={result.vehicle_breakdown} />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (type === 'maintenance-trends') {
      return (
        <div className="ai-result">
          <div className="ai-result-body" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Total Cost', value: `$${Number(result.summary?.total_cost).toLocaleString()}` },
                { label: 'Total Records', value: result.summary?.total_records },
                { label: 'Component Types', value: result.summary?.component_types },
                { label: 'Period', value: result.summary?.period },
              ].map((s) => (
                <div key={s.label} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{s.value ?? '—'}</div>
                </div>
              ))}
            </div>
            {result.ai_analysis && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: '#cbd5e1', marginBottom: 12 }}>AI Predictions & Recommendations</h3>
                <RenderValue value={result.ai_analysis} />
              </div>
            )}
            {result.by_component && (
              <div style={{ marginTop: 20 }}>
                <h3 style={{ color: '#cbd5e1', marginBottom: 12 }}>Cost by Component Type</h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '8px 10px', background: '#1e293b', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #334155' }}>Component</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', background: '#1e293b', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #334155' }}>Total Cost</th>
                      <th style={{ textAlign: 'right', padding: '8px 10px', background: '#1e293b', color: '#94a3b8', fontSize: 11, textTransform: 'uppercase', borderBottom: '1px solid #334155' }}>Records</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.by_component.map((c) => (
                      <tr key={c.component_type} style={{ borderBottom: '1px solid #1e293b' }}>
                        <td style={{ padding: '10px', color: '#e2e8f0', fontWeight: 500 }}>{c.component_type}</td>
                        <td style={{ padding: '10px', color: '#10b981', textAlign: 'right' }}>${Number(c.total_cost).toLocaleString()}</td>
                        <td style={{ padding: '10px', color: '#94a3b8', textAlign: 'right' }}>{c.total_records}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      );
    }

    if (type === 'cost-per-mile') {
      return (
        <div className="ai-result">
          <div className="ai-result-body" style={{ padding: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Fleet Avg Cost/Mile', value: result.summary ? `$${result.summary.fleet_avg_cost_per_mile}` : '—' },
                { label: 'Vehicles with Data', value: result.summary?.vehicles_with_data },
                { label: 'Period', value: result.summary?.period },
              ].map((s) => (
                <div key={s.label} style={{ background: '#1e293b', padding: 16, borderRadius: 8 }}>
                  <div style={{ color: '#94a3b8', fontSize: 12, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ color: '#fff', fontSize: 20, fontWeight: 700 }}>{s.value ?? '—'}</div>
                </div>
              ))}
            </div>
            <RenderValue value={result.data || result} />
          </div>
        </div>
      );
    }

    // Default render
    return (
      <div className="ai-result">
        <div className="ai-result-body" style={{ padding: 20 }}>
          <RenderValue value={result} />
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">{config?.description}</p>
        </div>
        <button className="btn btn-ai" onClick={runAnalysis} disabled={loading}>
          {loading ? <><span className="btn-spinner" /> Loading...</> : <>📊 Load Report</>}
        </button>
      </div>

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>x</button></div>}

      {loading && (
        <div className="ai-loading">
          <div className="ai-loading-animation">
            <div className="ai-pulse" />
            <div className="ai-pulse delay-1" />
            <div className="ai-pulse delay-2" />
          </div>
          <h3>Loading analytics data...</h3>
        </div>
      )}

      {!result && !loading && (
        <div className="ai-empty">
          <div className="ai-empty-icon">📊</div>
          <h3>Ready to Analyze</h3>
          <p>{config?.description}</p>
        </div>
      )}

      {renderResult()}
    </div>
  );
}
