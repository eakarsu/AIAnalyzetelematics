import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const fieldConfigs = {
  vehicles: {
    columns: ['id', 'license_plate', 'make', 'model', 'year', 'fuel_type', 'status', 'mileage'],
    formFields: [
      { name: 'vin', label: 'VIN', type: 'text', required: true },
      { name: 'make', label: 'Make', type: 'text', required: true },
      { name: 'model', label: 'Model', type: 'text', required: true },
      { name: 'year', label: 'Year', type: 'number', required: true },
      { name: 'license_plate', label: 'License Plate', type: 'text', required: true },
      { name: 'fuel_type', label: 'Fuel Type', type: 'select', options: ['diesel', 'gasoline', 'electric', 'hybrid'] },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'maintenance'] },
      { name: 'mileage', label: 'Mileage', type: 'number' },
      { name: 'lat', label: 'Latitude', type: 'number' },
      { name: 'lng', label: 'Longitude', type: 'number' },
    ],
  },
  drivers: {
    columns: ['id', 'name', 'email', 'phone', 'safety_score', 'status', 'vehicle_plate', 'total_trips'],
    formFields: [
      { name: 'name', label: 'Full Name', type: 'text', required: true },
      { name: 'email', label: 'Email', type: 'email', required: true },
      { name: 'phone', label: 'Phone', type: 'text' },
      { name: 'license_number', label: 'License Number', type: 'text', required: true },
      { name: 'license_expiry', label: 'License Expiry', type: 'date', required: true },
      { name: 'safety_score', label: 'Safety Score', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive', 'on_leave', 'suspended'] },
      { name: 'vehicle_id', label: 'Vehicle ID', type: 'number' },
    ],
  },
  routes: {
    columns: ['id', 'name', 'origin', 'destination', 'distance_miles', 'estimated_time_mins', 'traffic_level', 'status'],
    formFields: [
      { name: 'name', label: 'Route Name', type: 'text', required: true },
      { name: 'origin', label: 'Origin', type: 'text', required: true },
      { name: 'destination', label: 'Destination', type: 'text', required: true },
      { name: 'distance_miles', label: 'Distance (miles)', type: 'number', required: true },
      { name: 'estimated_time_mins', label: 'Est. Time (mins)', type: 'number', required: true },
      { name: 'avg_fuel_consumption', label: 'Avg Fuel Consumption', type: 'number' },
      { name: 'traffic_level', label: 'Traffic Level', type: 'select', options: ['light', 'moderate', 'heavy'] },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
    ],
  },
  fuel: {
    columns: ['id', 'vehicle_name', 'driver_name', 'route_name', 'gallons', 'cost', 'mpg', 'date', 'location'],
    formFields: [
      { name: 'vehicle_id', label: 'Vehicle ID', type: 'number', required: true },
      { name: 'driver_id', label: 'Driver ID', type: 'number' },
      { name: 'route_id', label: 'Route ID', type: 'number' },
      { name: 'gallons', label: 'Gallons', type: 'number', required: true },
      { name: 'cost', label: 'Cost ($)', type: 'number', required: true },
      { name: 'mpg', label: 'MPG', type: 'number' },
      { name: 'date', label: 'Date', type: 'date', required: true },
      { name: 'location', label: 'Location', type: 'text' },
    ],
  },
  safety: {
    columns: ['id', 'driver_name', 'vehicle_name', 'event_type', 'severity', 'location', 'speed_at_event', 'date'],
    formFields: [
      { name: 'driver_id', label: 'Driver ID', type: 'number', required: true },
      { name: 'vehicle_id', label: 'Vehicle ID', type: 'number', required: true },
      { name: 'event_type', label: 'Event Type', type: 'select', options: ['hard_braking', 'speeding', 'lane_departure', 'harsh_acceleration', 'tailgating', 'distracted_driving', 'seatbelt', 'harsh_cornering', 'fatigue', 'rolling_stop'] },
      { name: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'location', label: 'Location', type: 'text' },
      { name: 'speed_at_event', label: 'Speed (mph)', type: 'number' },
      { name: 'date', label: 'Date/Time', type: 'datetime-local', required: true },
    ],
  },
  trips: {
    columns: ['id', 'vehicle_name', 'driver_name', 'route_name', 'distance_miles', 'fuel_used', 'avg_speed', 'status', 'start_time'],
    formFields: [
      { name: 'vehicle_id', label: 'Vehicle ID', type: 'number', required: true },
      { name: 'driver_id', label: 'Driver ID', type: 'number', required: true },
      { name: 'route_id', label: 'Route ID', type: 'number' },
      { name: 'start_time', label: 'Start Time', type: 'datetime-local', required: true },
      { name: 'end_time', label: 'End Time', type: 'datetime-local' },
      { name: 'distance_miles', label: 'Distance (miles)', type: 'number' },
      { name: 'fuel_used', label: 'Fuel Used (gal)', type: 'number' },
      { name: 'avg_speed', label: 'Avg Speed (mph)', type: 'number' },
      { name: 'max_speed', label: 'Max Speed (mph)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['in_progress', 'completed', 'cancelled'] },
    ],
  },
  maintenance: {
    columns: ['id', 'vehicle_name', 'type', 'scheduled_date', 'status', 'priority', 'cost'],
    formFields: [
      { name: 'vehicle_id', label: 'Vehicle ID', type: 'number', required: true },
      { name: 'type', label: 'Type', type: 'text', required: true },
      { name: 'description', label: 'Description', type: 'textarea' },
      { name: 'scheduled_date', label: 'Scheduled Date', type: 'date', required: true },
      { name: 'completed_date', label: 'Completed Date', type: 'date' },
      { name: 'cost', label: 'Cost ($)', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['scheduled', 'in_progress', 'completed', 'cancelled'] },
      { name: 'priority', label: 'Priority', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { name: 'mileage_at_service', label: 'Mileage at Service', type: 'number' },
    ],
  },
  alerts: {
    columns: ['id', 'vehicle_name', 'driver_name', 'type', 'severity', 'message', 'is_read'],
    formFields: [
      { name: 'vehicle_id', label: 'Vehicle ID', type: 'number', required: true },
      { name: 'driver_id', label: 'Driver ID', type: 'number' },
      { name: 'type', label: 'Type', type: 'select', options: ['maintenance', 'safety', 'fuel', 'performance', 'geofence', 'weather', 'compliance'] },
      { name: 'severity', label: 'Severity', type: 'select', options: ['low', 'medium', 'high', 'critical'] },
      { name: 'message', label: 'Message', type: 'textarea', required: true },
    ],
  },
  geofences: {
    columns: ['id', 'name', 'type', 'center_lat', 'center_lng', 'radius_miles', 'status'],
    formFields: [
      { name: 'name', label: 'Name', type: 'text', required: true },
      { name: 'type', label: 'Type', type: 'select', options: ['warehouse', 'depot', 'terminal', 'port', 'rest_area', 'customer', 'fuel', 'restricted'] },
      { name: 'center_lat', label: 'Latitude', type: 'number', required: true },
      { name: 'center_lng', label: 'Longitude', type: 'number', required: true },
      { name: 'radius_miles', label: 'Radius (miles)', type: 'number', required: true },
      { name: 'status', label: 'Status', type: 'select', options: ['active', 'inactive'] },
      { name: 'alert_on_entry', label: 'Alert on Entry', type: 'checkbox' },
      { name: 'alert_on_exit', label: 'Alert on Exit', type: 'checkbox' },
    ],
  },
  insights: {
    columns: ['id', 'category', 'title', 'confidence', 'status', 'created_at'],
    formFields: [
      { name: 'category', label: 'Category', type: 'select', options: ['fuel', 'safety', 'maintenance', 'routing', 'performance'], required: true },
      { name: 'title', label: 'Title', type: 'text', required: true },
      { name: 'insight', label: 'Insight', type: 'textarea', required: true },
      { name: 'confidence', label: 'Confidence %', type: 'number' },
      { name: 'status', label: 'Status', type: 'select', options: ['new', 'acknowledged', 'resolved', 'dismissed'] },
    ],
  },
};

function formatValue(key, value) {
  if (value === null || value === undefined) return '—';
  if (key === 'is_read') return value ? 'Yes' : 'No';
  if (key === 'cost' && typeof value === 'number') return `$${Number(value).toLocaleString()}`;
  if (key === 'confidence') return `${value}%`;
  if (key.includes('date') || key.includes('time') || key === 'created_at') {
    return new Date(value).toLocaleString();
  }
  if (typeof value === 'number' && !key.includes('id') && !key.includes('year')) {
    return Number(value).toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function formatColumnHeader(col) {
  return col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function severityClass(severity) {
  const map = { critical: 'badge-critical', high: 'badge-high', medium: 'badge-medium', low: 'badge-low' };
  return map[severity] || '';
}

function statusClass(status) {
  const map = { active: 'badge-active', completed: 'badge-completed', scheduled: 'badge-scheduled', in_progress: 'badge-progress', inactive: 'badge-inactive', maintenance: 'badge-high' };
  return map[status] || '';
}

export default function CrudPage({ resource, title }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const config = fieldConfigs[resource] || { columns: ['id'], formFields: [] };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAll(resource);
      setItems(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [resource]);

  useEffect(() => {
    loadData();
    setSelected(null);
    setShowForm(false);
    setEditItem(null);
    setSearchTerm('');
  }, [resource, loadData]);

  const handleRowClick = (item) => {
    setSelected(selected?.id === item.id ? null : item);
    setShowForm(false);
  };

  const handleNew = () => {
    setFormData({});
    setEditItem(null);
    setShowForm(true);
    setSelected(null);
  };

  const handleEdit = (item) => {
    const data = { ...item };
    // Format dates for input fields
    config.formFields.forEach((f) => {
      if (f.type === 'date' && data[f.name]) {
        data[f.name] = new Date(data[f.name]).toISOString().split('T')[0];
      }
      if (f.type === 'datetime-local' && data[f.name]) {
        data[f.name] = new Date(data[f.name]).toISOString().slice(0, 16);
      }
    });
    setFormData(data);
    setEditItem(item);
    setShowForm(true);
    setSelected(null);
  };

  const handleDelete = async (item) => {
    if (!window.confirm(`Delete this ${resource.slice(0, -1)}?`)) return;
    try {
      await api.delete(resource, item.id);
      setSelected(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.update(resource, editItem.id, formData);
      } else {
        await api.create(resource, formData);
      }
      setShowForm(false);
      setEditItem(null);
      loadData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleFormChange = (name, value, type) => {
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? !prev[name] : type === 'number' ? (value === '' ? '' : Number(value)) : value,
    }));
  };

  const filtered = items.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return Object.values(item).some((v) => v != null && String(v).toLowerCase().includes(term));
  });

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{title}</h1>
          <p className="page-subtitle">{filtered.length} records</p>
        </div>
        <div className="page-actions">
          <input
            className="search-input"
            type="text"
            placeholder="Search..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <button className="btn btn-primary" onClick={handleNew}>+ New {resource.slice(0, -1)}</button>
        </div>
      </div>

      {error && <div className="error-banner">{error}<button onClick={() => setError('')}>x</button></div>}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editItem ? 'Edit' : 'New'} {resource.slice(0, -1)}</h2>
              <button className="modal-close" onClick={() => setShowForm(false)}>x</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              {config.formFields.map((field) => (
                <div key={field.name} className="form-group">
                  <label>{field.label}</label>
                  {field.type === 'select' ? (
                    <select
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFormChange(field.name, e.target.value, 'text')}
                      required={field.required}
                    >
                      <option value="">Select...</option>
                      {field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <textarea
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFormChange(field.name, e.target.value, 'text')}
                      required={field.required}
                      rows={3}
                    />
                  ) : field.type === 'checkbox' ? (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData[field.name] || false}
                        onChange={() => handleFormChange(field.name, null, 'checkbox')}
                      />
                      {field.label}
                    </label>
                  ) : (
                    <input
                      type={field.type}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleFormChange(field.name, e.target.value, field.type)}
                      required={field.required}
                      step={field.type === 'number' ? 'any' : undefined}
                    />
                  )}
                </div>
              ))}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selected && (
        <div className="detail-panel">
          <div className="detail-header">
            <h3>Record Details</h3>
            <div className="detail-actions">
              <button className="btn btn-edit" onClick={() => handleEdit(selected)}>Edit</button>
              <button className="btn btn-danger" onClick={() => handleDelete(selected)}>Delete</button>
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
          <div className="detail-grid">
            {Object.entries(selected).map(([key, value]) => (
              <div key={key} className="detail-field">
                <span className="detail-label">{formatColumnHeader(key)}</span>
                <span className="detail-value">
                  {key === 'severity' ? <span className={`badge ${severityClass(value)}`}>{value}</span> :
                   key === 'status' ? <span className={`badge ${statusClass(value)}`}>{value}</span> :
                   key === 'data' && typeof value === 'object' ? (
                     <pre className="detail-json">{JSON.stringify(value, null, 2)}</pre>
                   ) : formatValue(key, value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                {config.columns.map((col) => (
                  <th key={col}>{formatColumnHeader(col)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) => (
                <tr
                  key={item.id}
                  className={`table-row ${selected?.id === item.id ? 'selected' : ''}`}
                  onClick={() => handleRowClick(item)}
                >
                  {config.columns.map((col) => (
                    <td key={col}>
                      {col === 'severity' ? <span className={`badge ${severityClass(item[col])}`}>{item[col]}</span> :
                       col === 'status' ? <span className={`badge ${statusClass(item[col])}`}>{item[col]}</span> :
                       col === 'is_read' ? <span className={`badge ${item[col] ? 'badge-completed' : 'badge-critical'}`}>{item[col] ? 'Read' : 'Unread'}</span> :
                       formatValue(col, item[col])}
                    </td>
                  ))}
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={config.columns.length} className="empty-row">No records found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
