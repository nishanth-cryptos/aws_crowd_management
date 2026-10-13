const test = require('node:test');
const assert = require('node:assert/strict');
const { createCloudWatchSimulator } = require('./cloudWatchSimulator');

const zones = [{ id: 'North', name: 'North Square', capacity: 200 }, { id: 'Gazebo', name: 'Gazebo', capacity: 200 }];
const graph = { North: { Gazebo: 1 }, Gazebo: { North: 1 } };
function fixture() {
  let time = Date.parse('2026-01-01T12:00:00Z');
  const alerts = [];
  const monitor = createCloudWatchSimulator({ zones, graph, now: () => time, onBookingNotification: n => alerts.push(n) });
  const booking = { _id: 'event-1', zoneId: 'North', eventName: 'Campus event', organizer: 'Student', expectedAttendance: 100,
    startTime: new Date(time - 1000).toISOString(), endTime: new Date(time + 3600000).toISOString(), status: 'upcoming' };
  const rows = count => [{ zoneId: 'North', zoneName: 'North Square', capacity: 200, population: count },
    { zoneId: 'Gazebo', zoneName: 'Gazebo', capacity: 200, population: 31 }];
  monitor.syncBookings([booking]);
  return { monitor, booking, alerts, rows, tick: count => { time += 5000; monitor.observe(rows(count)); },
    advance: ms => { time += ms; monitor.checkFreshness(); }, read: () => monitor.snapshot('North').bookings[0] };
}

test('booking alarm is separate from zone threshold and includes event context', () => {
  const f = fixture();
  f.tick(90);
  assert.equal(f.monitor.snapshot('North').alarm.state, 'ALARM', 'original zone threshold remains 70');
  assert.equal(f.read().alarm.state, 'OK', 'booking threshold comes from expected attendance');
  assert.equal(f.read().metric.dimensions.BookingId, 'event-1');
  f.tick(100);
  assert.equal(f.read().alarm.state, 'OK', 'exactly planned attendance is not a breach');
  f.tick(101);
  assert.equal(f.read().alarm.state, 'ALARM');
  assert.equal(f.read().notifications.length, 1);
  const n = f.read().notifications[0];
  assert.equal(n.eventName, 'Campus event');
  assert.equal(n.expectedAttendance, 100);
  assert.equal(n.capacity, 200);
  assert.equal(n.label, 'Simulated SNS Notification');
  assert.match(n.reason, /exceeds planned attendance 100/);
  assert.equal(f.alerts.length, 1, 'existing alert callback gets the notification once');
});

test('capacity escalation, deduplication and recovery work per booking', () => {
  const f = fixture();
  for (const count of [50, 120, 150, 200, 201, 250, 199, 220]) f.tick(count);
  assert.equal(f.read().notifications.length, 2);
  assert.equal(f.read().notifications[0].severity, 'CRITICAL');
  assert.match(f.read().notifications[0].reason, /capacity 200 exceeded/);
  assert.equal(f.alerts.length, 2);
  f.tick(100);
  assert.equal(f.read().alarm.state, 'OK');
  assert(f.read().history.some(h => h.from === 'ALARM' && h.to === 'OK'));
  f.tick(110);
  assert.equal(f.read().notifications.length, 3, 'a fresh alarm episode can notify again');
});

test('upcoming bookings activate automatically; completed and cancelled events stop alerting', () => {
  const f = fixture();
  const future = { ...f.booking, startTime: '2026-01-01T12:01:00Z', endTime: '2026-01-01T12:02:00Z' };
  f.monitor.syncBookings([future]);
  f.tick(250);
  assert.equal(f.read().status, 'upcoming');
  assert.equal(f.read().observations.length, 0);
  assert.equal(f.alerts.length, 0);
  f.advance(60000);f.tick(120);
  assert.equal(f.read().status, 'active');
  assert.equal(f.alerts.length, 1);
  f.advance(60000);f.tick(250);
  assert.equal(f.read().status, 'completed');
  assert.equal(f.read().current.fresh, false);
  assert.equal(f.alerts.length, 1);
  const second = { ...f.booking, _id: 'event-2', endTime: '2026-01-01T14:00:00Z' };
  f.monitor.syncBookings([future, second]);
  f.monitor.startBookingDemo('North', 'event-2', 'surge');
  f.monitor.syncBookings([future]);
  f.monitor.applyDemo(f.rows(50), true);
  assert.equal(f.monitor.snapshot('North').demo, null, 'cancelled booking clears its demo override');
  f.tick(250);
  assert.equal(f.monitor.snapshot('North').bookings.find(b => b.id === 'event-2').status, 'cancelled');
  assert.equal(f.alerts.length, 1);
});

test('booking-specific presets use planned attendance and capacity through the existing generator', () => {
  const f = fixture();
  f.monitor.startBookingDemo('North', 'event-1', 'within');
  f.monitor.observe(f.monitor.applyDemo(f.rows(150), true));
  assert.equal(f.read().alarm.state, 'OK');
  f.monitor.startBookingDemo('North', 'event-1', 'surge');
  const surge = [];
  for (let i = 0; i < 4; i++) { const data = f.monitor.applyDemo(f.rows(150), true); surge.push(data[0].population); f.monitor.observe(data); }
  assert.deepEqual(surge, [80, 100, 101, 120]);
  assert.equal(f.read().notifications.length, 1);
  f.monitor.startBookingDemo('North', 'event-1', 'capacity');
  for (let i = 0; i < 4; i++) f.monitor.observe(f.monitor.applyDemo(f.rows(150), true));
  assert.equal(f.read().current.crowdCount, 220);
  assert.equal(f.read().current.severity, 'CRITICAL');
  f.monitor.startBookingDemo('North', 'event-1', 'normalize');
  for (let i = 0; i < 6; i++) f.monitor.observe(f.monitor.applyDemo(f.rows(150), true));
  assert.equal(f.read().current.crowdCount, 80);
  assert.equal(f.read().alarm.state, 'OK');
  assert.throws(() => f.monitor.startBookingDemo('Gazebo', 'event-1', 'surge'));
  assert.throws(() => f.monitor.startBookingDemo('North', 'event-1', 'random'));
});

test('saved registrations can be rebuilt after restart; freshness and histories remain bounded', () => {
  const f = fixture();
  for (let i = 0; i < 200; i++) f.tick(i % 2 ? 110 : 70);
  assert.equal(f.read().observations.length, 120);
  assert.equal(f.read().history.length, 100);
  f.monitor.pauseIngestion(true);
  f.advance(20000);
  assert.equal(f.read().alarm.state, 'INSUFFICIENT_DATA');
  assert.equal(f.read().recommendation.alternative, null);
  const restored = createCloudWatchSimulator({ zones, graph });
  restored.syncBookings([f.booking]);
  assert.equal(restored.snapshot('North').bookings[0].id, 'event-1');
  assert.equal(restored.snapshot('North').bookings[0].notifications.length, 0, 'alarm history is still session-only');
});

test('small planned events still get route recommendations on booking-specific HIGH severity', () => {
  const f = fixture();
  f.monitor.syncBookings([{ ...f.booking, expectedAttendance: 10 }]);
  f.monitor.observe([{ zoneId: 'North', zoneName: 'North Square', capacity: 200, population: 15 },
    { zoneId: 'Gazebo', zoneName: 'Gazebo', capacity: 200, population: 5 }]);
  assert.equal(f.read().current.severity, 'HIGH');
  assert.equal(f.read().recommendation.alternative.zoneId, 'Gazebo');
});
