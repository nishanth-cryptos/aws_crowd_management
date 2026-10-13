import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { Simulate } from 'react-dom/test-utils';
import BookingMonitoring from './BookingMonitoring';

const booking = (id, status = 'active') => ({
  id, status, zoneId: 'North', zoneName: 'North Square', eventName: `Event ${id}`,
  expectedAttendance: 100, capacity: 200, startTime: '2026-01-01T12:00:00Z', endTime: '2026-01-01T13:00:00Z',
  alarm: { name: `BookingCrowdAlarm-${id}`, state: 'ALARM', reason: 'Venue crowd 120 exceeds planned attendance 100 by 20.' },
  current: { crowdCount: 120, severity: 'HIGH', timestamp: '2026-01-01T12:01:00Z', fresh: true },
  history: [], notifications: [], recommendation: { message: 'Use Gazebo.', alternative: null },
});
let root;
let container;
beforeEach(() => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
const render = props => act(() => root.render(<BookingMonitoring {...props} />));

test('the requested saved booking is selected and its demo targets that exact booking', () => {
  const onAction = jest.fn();
  render({ bookings: [booking('first'), booking('saved')], selectedBookingId: 'saved', onAction });
  expect(container.querySelector('[aria-label="Saved booking"]').value).toBe('saved');
  const surge = Array.from(container.querySelectorAll('button')).find(b => b.textContent === 'Simulate unexpected arrivals');
  act(() => Simulate.click(surge));
  expect(onAction).toHaveBeenCalledWith('post', '/bookings/saved/demo', { scenario: 'surge' });
  expect(container.textContent).toContain('Venue crowd is an attendance estimate');
});

test('upcoming and completed events cannot run a booking surge demo', () => {
  render({ bookings: [booking('later', 'upcoming')], onAction: jest.fn() });
  expect(container.textContent).toContain('UPCOMING · armed');
  expect(Array.from(container.querySelectorAll('button')).every(b => b.disabled)).toBe(true);
  render({ bookings: [booking('later', 'completed')], onAction: jest.fn() });
  expect(container.textContent).toContain('COMPLETED · monitoring stopped');
  expect(Array.from(container.querySelectorAll('button')).every(b => b.disabled)).toBe(true);
});

test('booking SNS entries show the event, planned attendance, capacity and explicit simulated label', () => {
  const event = booking('saved');
  event.notifications = [{ id: 'n1', timestamp: '2026-01-01T12:01:00Z', label: 'Simulated SNS Notification',
    subject: 'HIGH BOOKING CROWD ALERT', severity: 'HIGH', eventName: event.eventName,
    crowdCount: 120, expectedAttendance: 100, capacity: 200, trigger: 'OK → ALARM', reason: event.alarm.reason, message: 'Use Gazebo.' }];
  render({ bookings: [event], onAction: jest.fn() });
  expect(container.textContent).toContain('Simulated SNS Notification');
  expect(container.textContent).toContain('HIGH BOOKING CROWD ALERT · Event saved');
  expect(container.textContent).toContain('Crowd 120 · Planned 100 · Capacity 200');
});
