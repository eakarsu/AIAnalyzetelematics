import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/map', label: 'Live Map', icon: '🗺️' },
  { type: 'divider', label: 'Fleet Management' },
  { path: '/vehicles', label: 'Vehicles', icon: '🚛' },
  { path: '/drivers', label: 'Drivers', icon: '👤' },
  { path: '/drivers/leaderboard', label: 'Driver Leaderboard', icon: '🏆' },
  { path: '/routes', label: 'Routes', icon: '📍' },
  { path: '/trips', label: 'Trip History', icon: '🛣️' },
  { type: 'divider', label: 'Operations' },
  { path: '/fuel', label: 'Fuel Logs', icon: '⛽' },
  { path: '/safety', label: 'Safety Events', icon: '🛡️' },
  { path: '/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/alerts', label: 'Alerts', icon: '🔔', badge: true },
  { path: '/geofences', label: 'Geofences', icon: '📌' },
  { type: 'divider', label: 'Analytics' },
  { path: '/analytics/carbon', label: 'Carbon Footprint', icon: '🌱' },
  { path: '/analytics/maintenance-trends', label: 'Maint. Trends', icon: '📉' },
  { path: '/analytics/cost-per-mile', label: 'Cost Per Mile', icon: '💲' },
  { path: '/analytics/fleet-utilization', label: 'Fleet Utilization', icon: '📈' },
  { type: 'divider', label: 'AI Analytics' },
  { path: '/insights', label: 'AI Insights', icon: '💡' },
  { path: '/ai/route-optimization', label: 'Route Optimization', icon: '🤖' },
  { path: '/ai/fuel-analysis', label: 'Fuel Analysis', icon: '🧠' },
  { path: '/ai/driver-analysis', label: 'Driver Analysis', icon: '📈' },
  { path: '/ai/predictive-maintenance', label: 'Predictive Maint.', icon: '⚙️' },
  { path: '/ai/fleet-insights', label: 'Fleet Insights', icon: '🔮' },
  { path: '/ai/fleet-summary', label: 'Fleet Summary', icon: '📋' },
  { path: '/ai/route-recommendation', label: 'Route Rec (Live)', icon: '🚦' },
  { path: '/ai/driver-coaching', label: 'Driver Coaching', icon: '🎯' },
  { path: '/ai/fuel-waste', label: 'Fuel Waste', icon: '🛢️' },
  { path: '/ai/carbon-tracker', label: 'Carbon Tracker', icon: '🌿' },
  { path: '/ai/breakdown-prevention', label: 'Breakdown Prevent', icon: '🔩' },
  { path: '/ai/load-balancer', label: 'Load Balancer', icon: '📦' },
  { path: '/ai/driver-wellness', label: 'Driver Wellness', icon: '💚' },
  { path: '/ai/cost-allocation', label: 'Cost Allocation', icon: '💰' },
  { path: '/ai/fuel-fraud', label: 'Fuel Fraud', icon: '🚨' },
  { path: '/ai/driver-burnout', label: 'Driver Burnout', icon: '🔥' },
  { path: '/ai/cost-per-mile-report', label: 'Cost/Mile Report', icon: '📐' },
  { path: '/ai/history', label: 'AI History', icon: '🕘' },
  { type: 'divider', label: 'Fleet Views' },
  { path: '/custom-views', label: 'Fleet Views', icon: '🧩' },
];

export default function Layout({ user, onLogout, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [unreadAlerts, setUnreadAlerts] = useState(0);

  // Poll unread alert count every 60 seconds
  const fetchUnreadAlerts = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const res = await fetch(`${API_BASE}/alerts?unread=true&limit=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      setUnreadAlerts(data.pagination?.total || 0);
    } catch {
      // silent — badge just won't update
    }
  }, []);

  useEffect(() => {
    fetchUnreadAlerts();
    const interval = setInterval(fetchUnreadAlerts, 60_000);
    return () => clearInterval(interval);
  }, [fetchUnreadAlerts]);

  return (
    <div className="app-layout">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-header">
          <div className="logo" onClick={() => navigate('/')}>
            {!collapsed && <><span className="logo-icon">🚀</span><span>FleetIQ</span></>}
            {collapsed && <span className="logo-icon">🚀</span>}
          </div>
          <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? '→' : '←'}
          </button>
        </div>
        <nav className="sidebar-nav">
          {menuItems.map((item, i) => {
            if (item.type === 'divider') {
              return !collapsed
                ? <div key={i} className="nav-divider">{item.label}</div>
                : <div key={i} className="nav-divider-line" />;
            }
            const isAlerts = item.badge;
            return (
              <button
                key={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : ''}
                style={{ position: 'relative' }}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
                {isAlerts && unreadAlerts > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: 6,
                    right: collapsed ? 4 : 12,
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '50%',
                    minWidth: 18,
                    height: 18,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 4px',
                  }}>
                    {unreadAlerts > 99 ? '99+' : unreadAlerts}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">{user.name?.[0]}</div>
            {!collapsed && (
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className="user-role">{user.role}</div>
              </div>
            )}
          </div>
          <button className="logout-btn" onClick={onLogout} title="Logout">
            {collapsed ? '🚪' : 'Logout'}
          </button>
        </div>
      </aside>
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
