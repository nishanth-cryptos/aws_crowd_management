import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import axios from 'axios';
import AWSMonitoring from './AWSMonitoring';

jest.mock('axios');
const snapshot = () => ({
  locations: [{ id: 'North', name: 'North Square' }],
  metric: { namespace: 'College/CrowdManagement', name: 'CrowdCount', unit: 'Count', dimensions: { Location: 'North Square' } },
  alarm: { name: 'HighCrowdAlarm-North', state: 'OK', reason: 'CrowdCount 35 ≤ threshold 70.',
    config: { threshold: 70, evaluationPeriods: 1, levels: { moderate: 50, high: 70, critical: 90 }, alternativeMaxOccupancy: 0.85 } },
  current: { crowdCount: 35, severity: 'NORMAL', timestamp: '2026-01-01T00:00:00Z', fresh: true, source: 'Existing crowd simulator' },
  observations: [], history: [], notifications: [],
  recommendation: { message: 'Continue using this zone.', alternative: null },
  demo: null, ingestionPaused: false,
});

let container;
let root;
beforeEach(() => {
  jest.useFakeTimers();
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  axios.get.mockImplementation(() => Promise.resolve({ data: { success: true, data: snapshot() } }));
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.useRealTimers();
  jest.clearAllMocks();
});
const render = async () => {
  await act(async () => { root.render(<AWSMonitoring apiUrl="http://localhost:5001/api" />); });
};

test('read-only polling preserves unsaved alarm configuration and stops on unmount', async () => {
  await render();
  const threshold = container.querySelector('[aria-label="Alarm threshold"]');
  act(() => Simulate.change(threshold, { target: { value: '80' } }));
  expect(threshold.value).toBe('80');
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(threshold.value).toBe('80');
  expect(axios).not.toHaveBeenCalled();
  expect(axios.get).toHaveBeenCalledTimes(2);
  act(() => root.unmount());
  await act(async () => { jest.advanceTimersByTime(5000); });
  expect(axios.get).toHaveBeenCalledTimes(2);
  // afterEach can safely unmount an already unmounted root.
});

test('crowd controls submit the chosen preset and show neutral monitoring copy', async () => {
  await render();
  axios.mockResolvedValueOnce({ data: { success: true, data: snapshot() } });
  const surge = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Simulate Crowd Surge');
  await act(async () => Simulate.click(surge));
  expect(axios).toHaveBeenCalledWith(expect.objectContaining({
    method: 'post', url: 'http://localhost:5001/api/monitoring/North/demo', data: { scenario: 'surge' },
  }));
  expect(container.textContent).toContain('Crowd Controls');
  expect(container.textContent).toContain('Intelligent crowd monitoring and alerts');
});

test('a lost monitoring connection withholds the previously displayed recommendation', async () => {
  await render();
  axios.get.mockRejectedValueOnce(new Error('offline'));
  await act(async () => { jest.advanceTimersByTime(1000); });
  expect(container.querySelector('[role="alert"]').textContent).toContain('Monitoring backend unavailable');
  expect(container.textContent).toContain('Waiting for the monitoring connection before recommending a route.');
  expect(container.textContent).toContain('STALE');
});
