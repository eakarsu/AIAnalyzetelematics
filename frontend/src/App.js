import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import CrudPage from './pages/CrudPage';
import AIPage from './pages/AIPage';
import AIStructuredPage from './pages/AIStructuredPage';
import AIHistoryPage from './pages/AIHistoryPage';
import DriverLeaderboardPage from './pages/DriverLeaderboardPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LiveMapPage from './pages/LiveMapPage';
import CustomViewsPage from './pages/CustomViewsPage';
import EldHoursViolationMonitor from './pages/EldHoursViolationMonitor';
import Layout from './components/Layout';
import './App.css';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

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
        <Route path="/codex/custom-viz" element={<CodexCustomVizFeature />} />
        <Route path="/codex/operations" element={<CodexOperationsFeature />} />

          <Route path="/" element={<Dashboard />} />
          <Route path="/map" element={<LiveMapPage />} />
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

          {/* Analytics Pages */}
          <Route path="/analytics/carbon" element={<AnalyticsPage type="carbon-footprint" title="Carbon Footprint Tracker" />} />
          <Route path="/analytics/maintenance-trends" element={<AnalyticsPage type="maintenance-trends" title="Maintenance Cost Trends" />} />
          <Route path="/analytics/cost-per-mile" element={<AnalyticsPage type="cost-per-mile" title="Cost Per Mile Report" />} />
          <Route path="/analytics/fleet-utilization" element={<AnalyticsPage type="fleet-utilization" title="Fleet Utilization" />} />

          {/* Driver features */}
          <Route path="/drivers/leaderboard" element={<DriverLeaderboardPage />} />

          {/* Legacy AI pages (now return structured JSON rendered via AIStructuredPage) */}
          <Route path="/ai/route-optimization" element={<AIPage type="optimize-route" title="AI Route Optimization" />} />
          <Route path="/ai/fuel-analysis" element={<AIPage type="analyze-fuel" title="AI Fuel Analysis" />} />
          <Route path="/ai/driver-analysis" element={<AIPage type="analyze-drivers" title="AI Driver Behavior" />} />
          <Route path="/ai/predictive-maintenance" element={<AIPage type="predict-maintenance" title="AI Predictive Maintenance" />} />
          <Route path="/ai/fleet-insights" element={<AIPage type="fleet-insights" title="AI Fleet Insights" />} />
          <Route path="/ai/fleet-summary" element={
            <AIStructuredPage
              endpoint="fleet-summary-report"
              title="Fleet Summary Report"
              description="Comprehensive multi-domain executive report — vehicles, drivers, fuel, safety, maintenance aggregated into one health score."
            />
          } />

          {/* Structured AI features */}
          <Route path="/ai/route-recommendation" element={
            <AIStructuredPage
              endpoint="route-recommendation"
              title="Dynamic Route Recommendation"
              description="Real-time route optimization for an in-progress vehicle/destination."
              formFields={[
                { name: 'vehicle_id', label: 'Vehicle ID', type: 'number', required: true },
                { name: 'destination', label: 'Destination', type: 'text', required: true, placeholder: 'e.g., 123 Main St, Austin TX' },
              ]}
            />
          } />
          <Route path="/ai/driver-coaching" element={
            <AIStructuredPage
              endpoint="driver-coaching"
              title="Driver Coaching Bot"
              description="Personalized coaching messages based on safety events."
              formFields={[
                { name: 'driver_id', label: 'Driver ID', type: 'number', required: true },
              ]}
            />
          } />
          <Route path="/ai/fuel-waste" element={
            <AIStructuredPage
              endpoint="fuel-waste"
              title="Fuel Waste Detector"
              description="Idling time + route deviation; AI alerts on anomalies with diagnostic hints."
            />
          } />
          <Route path="/ai/carbon-tracker" element={
            <AIStructuredPage
              endpoint="carbon-tracker"
              title="Fleet Carbon Tracker"
              description="Emissions per trip; AI suggests green route alternatives + EV ROI analysis."
            />
          } />
          <Route path="/ai/breakdown-prevention" element={
            <AIStructuredPage
              endpoint="breakdown-prevention"
              title="Predictive Breakdown Prevention"
              description="AI schedules proactive maintenance windows minimizing downtime + cost."
            />
          } />
          <Route path="/ai/load-balancer" element={
            <AIStructuredPage
              endpoint="load-balancer"
              title="Partner Load Balancing"
              description="AI matches incoming shipments to optimal vehicle + driver combos."
              formFields={[
                { name: 'shipments', label: 'Shipments (JSON array)', type: 'json', required: true,
                  default: '[{"shipment_id":"S1","origin":"Austin","destination":"Dallas","weight_lb":1500,"deadline":"2026-05-04T17:00:00Z"}]',
                  placeholder: '[{ "shipment_id": "S1", "origin": "...", "destination": "...", "weight_lb": 0 }]' },
              ]}
            />
          } />
          <Route path="/ai/driver-wellness" element={
            <AIStructuredPage
              endpoint="driver-wellness"
              title="Driver Wellness Monitor"
              description="AI flags fatigue risk + suggests rest periods before HOS violations."
              formFields={[
                { name: 'driver_id', label: 'Driver ID (leave blank for fleet-wide)', type: 'number', required: false },
              ]}
            />
          } />
          <Route path="/ai/cost-allocation" element={
            <AIStructuredPage
              endpoint="cost-allocation"
              title="Cost Allocation Optimizer"
              description="Per-trip fuel + labor + wear; AI rebalances rates + margins by route profitability."
            />
          } />
          <Route path="/ai/fuel-fraud" element={
            <AIStructuredPage
              endpoint="fuel-fraud"
              title="Fuel Fraud Detection"
              description="AI cross-references fuel logs with GPS trip data to flag potential fraud, tank overflows, and anomalies."
            />
          } />
          <Route path="/ai/driver-burnout" element={
            <AIStructuredPage
              endpoint="driver-burnout"
              title="Driver Burnout Predictor"
              description="AI predicts driver burnout and churn risk based on hours, incidents, and behavior patterns."
              formFields={[
                { name: 'driver_id', label: 'Driver ID (leave blank for fleet-wide)', type: 'number', required: false },
              ]}
            />
          } />
          <Route path="/ai/cost-per-mile-report" element={
            <AIStructuredPage
              endpoint="cost-per-mile-report"
              title="Cost-Per-Mile Intelligence Report"
              description="AI analyzes fuel + maintenance cost per mile per vehicle and identifies optimization opportunities."
            />
          } />
          <Route path="/ai/history" element={<AIHistoryPage />} />
          <Route path="/custom-views" element={<CustomViewsPage />} />
          <Route path="/eld-hours-violation-monitor" element={<EldHoursViolationMonitor />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
