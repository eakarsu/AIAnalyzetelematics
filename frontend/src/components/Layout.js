import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { type: 'divider', label: 'Fleet Management' },
  { path: '/vehicles', label: 'Vehicles', icon: '🚛' },
  { path: '/drivers', label: 'Drivers', icon: '👤' },
  { path: '/routes', label: 'Routes', icon: '🗺️' },
  { path: '/trips', label: 'Trip History', icon: '📍' },
  { type: 'divider', label: 'Operations' },
  { path: '/fuel', label: 'Fuel Logs', icon: '⛽' },
  { path: '/safety', label: 'Safety Events', icon: '🛡️' },
  { path: '/maintenance', label: 'Maintenance', icon: '🔧' },
  { path: '/alerts', label: 'Alerts', icon: '🔔' },
  { path: '/geofences', label: 'Geofences', icon: '📌' },
  { type: 'divider', label: 'AI Analytics' },
  { path: '/insights', label: 'AI Insights', icon: '💡' },
  { path: '/ai/route-optimization', label: 'Route Optimization', icon: '🤖' },
  { path: '/ai/fuel-analysis', label: 'Fuel Analysis', icon: '🧠' },
  { path: '/ai/driver-analysis', label: 'Driver Analysis', icon: '📈' },
  { path: '/ai/predictive-maintenance', label: 'Predictive Maint.', icon: '⚙️' },
  { path: '/ai/fleet-insights', label: 'Fleet Insights', icon: '🔮' },
];

export default function Layout({ user, onLogout, children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
              return !collapsed ? <div key={i} className="nav-divider">{item.label}</div> : <div key={i} className="nav-divider-line" />;
            }
            return (
              <button
                key={item.path}
                className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={collapsed ? item.label : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                {!collapsed && <span className="nav-label">{item.label}</span>}
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
