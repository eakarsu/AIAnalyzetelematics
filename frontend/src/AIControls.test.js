import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import Login from './pages/Login';
import AIFieldPresets, { completeExample } from './pages/AIFieldPresets';
import AIResultView from './pages/AIResultView';
import AIReport from './components/AIReport';
import AIHistoryPage from './pages/AIHistoryPage';
import AIWorkspace from './components/AIWorkspace';

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('./services/api', () => ({ api: { login: jest.fn() } }));
import { api } from './services/api';

test('every preset fills editable fields, preserves real references and files, and never submits', () => {
  const fields = [
    { name: 'destination', label: 'Destination', required: true },
    { name: 'notes', label: 'Notes', type: 'textarea' },
    { name: 'vehicle_id', label: 'Vehicle', type: 'select', required: true, options: [{ value: 'saved-vehicle', label: 'Saved vehicle' }] },
    { name: 'driver_id', label: 'Driver', type: 'select', required: true, options: [] },
    { name: 'attachment', label: 'Attachment', type: 'file' },
  ];
  const file = new File(['fixture'], 'fixture.txt');
  for (let index = 0; index < 3; index++) {
    const filled = completeExample(fields, {}, index, 'Route planning', { vehicle_id: 'saved-vehicle', attachment: file });
    expect(filled.destination).toBeTruthy();
    expect(filled.notes).toBeTruthy();
    expect(filled.vehicle_id).toBe('saved-vehicle');
    expect(filled.driver_id).toBe('');
    expect(filled.attachment).toBe(file);
  }
  const html = renderToStaticMarkup(<form><AIFieldPresets fields={fields} onFill={() => {}} context="Route planning" /></form>);
  expect((html.match(/type="button"/g) || []).length).toBeGreaterThanOrEqual(3);
  expect(html).toContain('Select an actual source record');
  expect(html).toContain('preserve selected uploads');
});

test('returned and saved reports display nested facts, tables, false, zero, and empty strings', () => {
  const result = { result_json: { summary: { approved: false, count: 0, note: '' }, findings: [{ item: 'Brake inspection', score: 0 }, { item: 'Tire review', score: 2 }] }, status: 'Reviewed' };
  for (const Component of [AIResultView, AIReport]) {
    const html = renderToStaticMarkup(Component === AIReport ? <Component response={result} /> : <Component result={result} />);
    expect(html).toContain('Summary');
    expect(html).toContain('Approved');
    expect(html).toContain('No');
    expect(html).toContain('Count');
    expect(html).toContain('0');
    expect(html).toContain('Empty string');
    expect(html).toContain('<table');
    expect(html).toContain('Brake inspection');
    expect(html).toContain('Status');
    expect(html).not.toContain('&quot;result_json&quot;');
  }
});

test('demo control only fills configured credentials; absent configuration is explicit', () => {
  const oldEmail = process.env.REACT_APP_DEMO_EMAIL;
  const oldPassword = process.env.REACT_APP_DEMO_PASSWORD;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    process.env.REACT_APP_DEMO_EMAIL = 'demo@example.test';
    process.env.REACT_APP_DEMO_PASSWORD = 'fixture-password';
    act(() => root.render(<Login onLogin={() => {}} />));
    const button = container.querySelector('[aria-label="Fill demo credentials"]');
    expect(button.disabled).toBe(false);
    act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.querySelector('input[type="email"]').value).toBe('demo@example.test');
    expect(container.querySelector('input[type="password"]').value).toBe('fixture-password');
    expect(api.login).not.toHaveBeenCalled();
    delete process.env.REACT_APP_DEMO_EMAIL;
    delete process.env.REACT_APP_DEMO_PASSWORD;
    act(() => root.render(<Login onLogin={() => {}} />));
    expect(container.querySelector('[aria-label="Fill demo credentials"]').disabled).toBe(true);
    expect(container.textContent).toContain('not configured');
  } finally {
    act(() => root.unmount());
    container.remove();
    if (oldEmail === undefined) delete process.env.REACT_APP_DEMO_EMAIL; else process.env.REACT_APP_DEMO_EMAIL = oldEmail;
    if (oldPassword === undefined) delete process.env.REACT_APP_DEMO_PASSWORD; else process.env.REACT_APP_DEMO_PASSWORD = oldPassword;
  }
});

test('saved AI history detail renders structured output from a local response fixture', async () => {
  const originalFetch = global.fetch;
  const fixture = { id: 1, analysis_type: 'fleet-insights', created_at: '2026-10-10T12:00:00Z', input_data: { scope: 'fleet' }, result: { result_json: { summary: { approved: false, count: 0, note: '' }, findings: [{ item: 'Inspection', score: 0 }] } } };
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [fixture], pagination: { page: 1, total_pages: 1, total: 1 } }) });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<AIHistoryPage />); });
    expect(container.textContent).toContain('fleet-insights');
    await act(async () => container.querySelector('tbody tr').dispatchEvent(new MouseEvent('click', { bubbles: true })));
    expect(container.textContent).toContain('Summary');
    expect(container.textContent).toContain('No');
    expect(container.textContent).toContain('0');
    expect(container.textContent).toContain('Empty string');
    expect(container.querySelector('.sr-report-table')).not.toBeNull();
  } finally {
    act(() => root.unmount());
    container.remove();
    global.fetch = originalFetch;
  }
});

test('workspace preset buttons fill all ten fields without generating', async () => {
  const originalFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) });
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<AIWorkspace feature={{ id: 'fixture', title: 'Fleet planning', description: 'Local fixture' }} />); });
    const buttons = [...container.querySelectorAll('.ai-preset-bar button')];
    expect(buttons).toHaveLength(3);
    for (const button of buttons) {
      act(() => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      const values = [...container.querySelectorAll('.ai-form-grid textarea, .ai-form-grid input, .ai-form-grid select')].map((element) => element.value);
      expect(values).toHaveLength(10);
      expect(values.every(Boolean)).toBe(true);
    }
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch.mock.calls[0][1]?.method).not.toBe('POST');
  } finally {
    act(() => root.unmount());
    container.remove();
    global.fetch = originalFetch;
  }
});
