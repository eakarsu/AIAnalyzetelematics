import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CrudPage from './pages/CrudPage';
import AIPage from './pages/AIPage';
import Layout from './components/Layout';
import './App.css';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (token && savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  if (!user) return <Login onLogin={handleLogin} />;

  return (
    <BrowserRouter>
      <Layout user={user} onLogout={handleLogout}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vehicles" element={<CrudPage resource="vehicles" title="Vehicle Management" />} />
          <Route path="/drivers" element={<CrudPage resource="drivers" title="Driver Management" />} />
          <Route path="/routes" element={<CrudPage resource="routes" title="Route Management" />} />
          <Route path="/fuel" element={<CrudPage resource="fuel" title="Fuel Consumption" />} />
          <Route path="/safety" element={<CrudPage resource="safety" title="Safety Events" />} />
          <Route path="/trips" element={<CrudPage resource="trips" title="Trip History" />} />
          <Route path="/maintenance" element={<CrudPage resource="maintenance" title="Maintenance" />} />
          <Route path="/alerts" element={<CrudPage resource="alerts" title="Fleet Alerts" />} />
          <Route path="/geofences" element={<CrudPage resource="geofences" title="Geofencing" />} />
          <Route path="/insights" element={<CrudPage resource="insights" title="AI Insights" />} />
          <Route path="/ai/route-optimization" element={<AIPage type="optimize-route" title="AI Route Optimization" />} />
          <Route path="/ai/fuel-analysis" element={<AIPage type="analyze-fuel" title="AI Fuel Analysis" />} />
          <Route path="/ai/driver-analysis" element={<AIPage type="analyze-drivers" title="AI Driver Behavior" />} />
          <Route path="/ai/predictive-maintenance" element={<AIPage type="predict-maintenance" title="AI Predictive Maintenance" />} />
          <Route path="/ai/fleet-insights" element={<AIPage type="fleet-insights" title="AI Fleet Insights" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
