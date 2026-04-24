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

function parseMarkdown(text) {
  if (!text) return '';
  // Convert markdown-like formatting to structured HTML
  let html = text
    .replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gm, '<h4 class="ai-h4">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="ai-h3">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="ai-h2">$1</h2>')
    .replace(/^---$/gm, '<hr class="ai-divider"/>')
    .replace(/^\d+\.\s(.*$)/gm, '<li class="ai-ordered">$1</li>')
    .replace(/^[-•]\s(.*$)/gm, '<li class="ai-bullet">$1</li>')
    .replace(/`([^`]+)`/g, '<code class="ai-code">$1</code>')
    .replace(/\n\n/g, '</p><p class="ai-para">')
    .replace(/\n/g, '<br/>');
  return `<p class="ai-para">${html}</p>`;
}

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
            <>🤖 Run AI Analysis</>
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
              <span className="ai-badge ai-badge-category">{result.category?.replace(/_/g, ' ')}</span>
              <span className="ai-badge ai-badge-time">{new Date(result.timestamp).toLocaleString()}</span>
              {result.usage && (
                <span className="ai-badge ai-badge-tokens">
                  {result.usage.total_tokens?.toLocaleString()} tokens
                </span>
              )}
            </div>
          </div>
          <div className="ai-result-body">
            <div
              className="ai-content"
              dangerouslySetInnerHTML={{ __html: parseMarkdown(result.analysis) }}
            />
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="ai-empty">
          <div className="ai-empty-icon">🤖</div>
          <h3>Ready to Analyze</h3>
          <p>Click "Run AI Analysis" to generate insights from your fleet data using AI.</p>
          <p className="ai-empty-note">Analysis uses real-time data from your database.</p>
        </div>
      )}
    </div>
  );
}
