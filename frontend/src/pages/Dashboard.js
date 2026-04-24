import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const dashboardCards = [
  { key: 'total_vehicles', label: 'Total Vehicles', icon: '🚛', path: '/vehicles', color: '#3b82f6' },
  { key: 'active_vehicles', label: 'Active Vehicles', icon: '✅', path: '/vehicles', color: '#10b981' },
  { key: 'total_drivers', label: 'Total Drivers', icon: '👤', path: '/drivers', color: '#8b5cf6' },
  { key: 'active_trips', label: 'Active Trips', icon: '📍', path: '/trips', color: '#f59e0b' },
  { key: 'unread_alerts', label: 'Unread Alerts', icon: '🔔', path: '/alerts', color: '#ef4444' },
  { key: 'pending_maintenance', label: 'Pending Maintenance', icon: '🔧', path: '/maintenance', color: '#f97316' },
  { key: 'avg_safety_score', label: 'Avg Safety Score', icon: '🛡️', path: '/safety', color: '#06b6d4' },
  { key: 'monthly_fuel_cost', label: 'Monthly Fuel Cost', icon: '⛽', path: '/fuel', color: '#ec4899', prefix: '$' },
  { key: 'avg_mpg', label: 'Average MPG', icon: '📊', path: '/fuel', color: '#14b8a6', suffix: ' mpg' },
  { key: 'active_geofences', label: 'Active Geofences', icon: '📌', path: '/geofences', color: '#6366f1' },
  { key: 'new_insights', label: 'New AI Insights', icon: '💡', path: '/insights', color: '#a855f7' },
  { key: 'weekly_safety_events', label: 'Weekly Safety Events', icon: '⚠️', path: '/safety', color: '#dc2626' },
  { key: 'monthly_miles', label: 'Monthly Miles', icon: '🛣️', path: '/trips', color: '#0891b2' },
  { key: 'vehicles_in_maintenance', label: 'In Maintenance', icon: '⚙️', path: '/maintenance', color: '#d97706' },
  { key: 'active_drivers', label: 'Active Drivers', icon: '🏃', path: '/drivers', color: '#059669' },
];

const aiCards = [
  { path: '/ai/route-optimization', label: 'AI Route Optimization', icon: '🤖', desc: 'Optimize routes using AI analysis of traffic, fuel, and distance data' },
  { path: '/ai/fuel-analysis', label: 'AI Fuel Analysis', icon: '🧠', desc: 'Deep analysis of fuel consumption patterns and cost savings' },
  { path: '/ai/driver-analysis', label: 'AI Driver Analysis', icon: '📈', desc: 'Behavior analysis, risk scoring, and training recommendations' },
  { path: '/ai/predictive-maintenance', label: 'AI Predictive Maintenance', icon: '⚙️', desc: 'Predict failures before they happen, optimize service schedules' },
  { path: '/ai/fleet-insights', label: 'AI Fleet Insights', icon: '🔮', desc: 'Executive-level fleet health report and strategic recommendations' },
];

export default function Dashboard() {
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Fleet Dashboard</h1>
        <p className="page-subtitle">Real-time overview of your fleet operations</p>
      </div>

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <>
          <div className="stats-grid">
            {dashboardCards.map((card) => (
              <div key={card.key} className="stat-card" onClick={() => navigate(card.path)} style={{ '--accent': card.color }}>
                <div className="stat-icon">{card.icon}</div>
                <div className="stat-info">
                  <div className="stat-value">
                    {card.prefix || ''}{stats[card.key] != null ? Number(stats[card.key]).toLocaleString() : '—'}{card.suffix || ''}
                  </div>
                  <div className="stat-label">{card.label}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="section-header">
            <h2>AI Analytics</h2>
            <p>Powered by OpenRouter AI</p>
          </div>
          <div className="ai-cards-grid">
            {aiCards.map((card) => (
              <div key={card.path} className="ai-card" onClick={() => navigate(card.path)}>
                <div className="ai-card-icon">{card.icon}</div>
                <h3>{card.label}</h3>
                <p>{card.desc}</p>
                <div className="ai-card-action">Run Analysis →</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
