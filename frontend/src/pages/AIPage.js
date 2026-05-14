import React, { useState } from 'react';
import { api } from '../services/api';

const aiEndpoints = {
  'optimize-route': api.aiOptimizeRoute,
  'analyze-fuel': api.aiAnalyzeFuel,
  'analyze-drivers': api.aiAnalyzeDrivers,
  'predict-maintenance': api.aiPredictMaintenance,
  'fleet-insights': api.aiFleetInsights,
};

const descriptions = {
  'optimize-route': 'Analyzes route data, traffic patterns, and fuel consumption to recommend optimized routes that reduce costs and travel time.',
  'analyze-fuel': 'Deep analysis of fuel consumption across your fleet, identifying inefficiencies and cost-saving opportunities.',
  'analyze-drivers': 'Evaluates driver behavior patterns, safety scores, and risk factors to improve fleet safety.',
  'predict-maintenance': 'Uses vehicle data and maintenance history to predict potential failures before they happen.',
  'fleet-insights': 'Comprehensive executive-level analysis of overall fleet health, KPIs, and strategic recommendations.',
};

// Renders structured JSON results as formatted tables/lists
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
      <div style={{ paddingLeft: depth > 0 ? 12 : 0, borderLeft: depth > 0 ? '2px solid #334155' : 'none', marginTop: depth > 0 ? 4 : 0 }}>
        {Object.entries(value).map(([k, v]) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <strong style={{ color: '#94a3b8', fontSize: 12, textTransform: 'uppercase' }}>{k.replace(/_/g, ' ')}: </strong>
            <RenderValue value={v} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'boolean') return <span style={{ color: value ? '#22c55e' : '#ef4444' }}>{value ? 'Yes' : 'No'}</span>;
  return <span style={{ color: '#e2e8f0' }}>{String(value)}</span>;
}

// Exclude meta fields from the structured render
const META_KEYS = new Set(['model', 'usage', 'timestamp', 'category']);

export default function AIPage({ type, title }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const fn = aiEndpoints[type];
      const data = await fn();
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Strip meta keys and render only the AI analysis content
  const renderStructuredResult = (data) => {
    if (!data) return null;
    const content = {};
    for (const [k, v] of Object.entries(data)) {
      if (!META_KEYS.has(k)) content[k] = v;
    }
    return <RenderValue value={content} />;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">{descriptions[type]}</p>
        </div>
        <button className="btn btn-ai" onClick={runAnalysis} disabled={loading}>
          {loading ? (
            <><span className="btn-spinner" /> Analyzing...</>
          ) : (
            <>Run AI Analysis</>
          )}
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
          <h3>AI is analyzing your fleet data...</h3>
          <p>This may take a few moments</p>
        </div>
      )}

      {result && (
        <div className="ai-result">
          <div className="ai-result-header">
            <div className="ai-result-meta">
              <span className="ai-badge ai-badge-model">Model: {result.model || 'AI'}</span>
              {result.category && (
                <span className="ai-badge ai-badge-category">{result.category.replace(/_/g, ' ')}</span>
              )}
              {result.timestamp && (
                <span className="ai-badge ai-badge-time">{new Date(result.timestamp).toLocaleString()}</span>
              )}
              {result.usage && (
                <span className="ai-badge ai-badge-tokens">
                  {result.usage.total_tokens?.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>
          <div className="ai-result-body" style={{ padding: 20 }}>
            {result.raw_response ? (
              <pre style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', fontSize: 13 }}>{result.raw_response}</pre>
            ) : (
              renderStructuredResult(result)
            )}
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="ai-empty">
          <div className="ai-empty-icon">🤖</div>
          <h3>Ready to Analyze</h3>
          <p>Click "Run AI Analysis" to generate structured insights from your fleet data.</p>
          <p className="ai-empty-note">Analysis uses real-time data from your database. Results are persisted to AI History.</p>
        </div>
      )}
    </div>
  );
}
