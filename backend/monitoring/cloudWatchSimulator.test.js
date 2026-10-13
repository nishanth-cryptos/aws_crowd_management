const test = require('node:test');
const assert = require('node:assert/strict');
const defaults = require('./config');
const { classifyCrowd, evaluateAlarm, recommendRoute } = require('./alarmEngine');
const { createCloudWatchSimulator } = require('./cloudWatchSimulator');
const { registerMonitoringRoutes } = require('./routes');

const zones = [
  { id: 'North', name: 'North Square', capacity: 200 },
  { id: 'Gazebo', name: 'Gazebo', capacity: 200 },
  { id: 'Admin', name: 'Admin Block', capacity: 250 },
  { id: 'AB1', name: 'AB1', capacity: 5880 },
];
const graph = { North: { AB1: 2, Admin: 1, Gazebo: 1 }, Gazebo: { North: 1 }, Admin: { North: 1 }, AB1: { North: 2 } };
const rows = count => zones.map(z => ({ zoneId: z.id, zoneName: z.name, capacity: z.capacity,
  population: z.id === 'North' ? count : z.id === 'Gazebo' ? 31 : 48 }));
function fixture() {
  let timestamp = Date.parse('2026-01-01T00:00:00Z');
  const simulator = createCloudWatchSimulator({ zones, graph, now: () => timestamp });
  return {
    simulator,
    tick: (count, step = 5000) => { timestamp += step; simulator.observe(rows(count)); },
    advance: ms => { timestamp += ms; simulator.checkFreshness(); },
    read: () => simulator.snapshot('North'),
  };
}

test('severity boundaries and strict alarm equality are independent', () => {
  for (const [count, expected] of [[0, 'NORMAL'], [49, 'NORMAL'], [50, 'MODERATE'], [69, 'MODERATE'], [70, 'HIGH'], [89, 'HIGH'], [90, 'CRITICAL']]) {
    assert.equal(classifyCrowd(count, defaults.levels), expected);
  }
  assert.equal(evaluateAlarm([{ crowdCount: 70 }], defaults).state, 'OK');
  assert.equal(evaluateAlarm([{ crowdCount: 71 }], defaults).state, 'ALARM');
});

test('normal, moderate, surge, critical escalation, deduplication and recovery', () => {
  const f = fixture();
  assert.equal(f.read().alarm.state, 'INSUFFICIENT_DATA');
  for (const count of [35, 47, 59, 68, 76, 87, 94, 94, 88, 94]) f.tick(count);
  assert.equal(f.read().alarm.state, 'ALARM');
  assert.equal(f.read().notifications.length, 2, 'one alarm entry + one critical escalation per episode');
  assert.equal(f.read().notifications[0].label, 'Simulated SNS Notification');
  assert.equal(f.read().notifications[1].trigger, 'OK → ALARM');
  assert.equal(f.read().recommendation.alternative.zoneId, 'Gazebo');
  for (const count of [87, 76, 68, 59, 47, 35]) f.tick(count);
  assert.equal(f.read().alarm.state, 'OK');
  assert.equal(f.read().notifications.length, 2);
  assert(f.read().history.some(h => h.from === 'ALARM' && h.to === 'OK'));
  f.tick(76);
  assert.equal(f.read().notifications.length, 3, 'new episode alerts again');
  assert.equal(f.read().observations.at(-1).alarmState, 'ALARM');
});

test('N-of-N evaluation, per-location configuration and validation', () => {
  const f = fixture();
  f.simulator.configure('North', { threshold: 70, evaluationPeriods: 2, moderate: 50, high: 70, critical: 90 });
  f.tick(76);
  assert.equal(f.read().alarm.state, 'INSUFFICIENT_DATA');
  f.tick(87);
  assert.equal(f.read().alarm.state, 'ALARM');
  f.tick(68);
  assert.equal(f.read().alarm.state, 'OK');
  assert.equal(f.simulator.snapshot('Gazebo').alarm.config.evaluationPeriods, 1);
  assert.throws(() => f.simulator.configure('North', { threshold: '70', evaluationPeriods: 1, moderate: 50, high: 70, critical: 90 }));
  assert.throws(() => f.simulator.configure('North', { threshold: 70, evaluationPeriods: 0, moderate: 90, high: 70, critical: 50 }));
  assert.throws(() => f.simulator.snapshot('Unknown'));
});

test('missing data clears evaluation window, hides route and recovers on fresh data', () => {
  const f = fixture();
  f.tick(94);
  f.simulator.pauseIngestion(true);
  f.tick(35, 20000);
  assert.equal(f.read().alarm.state, 'INSUFFICIENT_DATA');
  assert.equal(f.read().current.fresh, false);
  assert.equal(f.read().recommendation.alternative, null);
  assert.equal(f.read().observations.length, 1);
  assert.equal(f.read().notifications.length, 1);
  const count = f.read().history.length;
  f.advance(5000);
  assert.equal(f.read().history.length, count, 'stale reads do not duplicate transitions');
  f.simulator.pauseIngestion(false);
  f.tick(35);
  assert.equal(f.read().alarm.state, 'OK');
  assert.equal(f.read().current.fresh, true);
});

test('demo reuses original data, follows exact preset, holds and restores random source', () => {
  const f = fixture();
  f.simulator.startDemo('North', 'surge');
  const values = [];
  for (let i = 0; i < 9; i++) {
    const generated = f.simulator.applyDemo(rows(120), true);
    values.push(generated[0].population);
    f.simulator.observe(generated);
    const step = f.read().demo.step;
    f.simulator.applyDemo(rows(120), false);
    assert.equal(f.read().demo.step, step, 'manual refresh does not advance preset');
  }
  assert.deepEqual(values, [35, 47, 59, 68, 76, 87, 94, 94, 94]);
  assert.equal(f.read().notifications.length, 2);
  assert.match(f.read().recommendation.alternative.source, /simulated/);
  f.simulator.startDemo('North', 'normalize');
  const down = Array.from({ length: 7 }, () => f.simulator.applyDemo(rows(120), true)[0].population);
  assert.deepEqual(down, [94, 87, 76, 68, 59, 47, 35]);
  f.simulator.stopDemo();
  assert.equal(f.simulator.applyDemo(rows(120), true)[0].population, 120);
  assert.equal(f.read().demo, null);
});

test('recommendation excludes disconnected, full and busier alternatives', () => {
  const source = rows(94)[0];
  const alternatives = [...rows(94), { zoneId: 'Elsewhere', zoneName: 'Disconnected', population: 0, capacity: 100 }];
  assert.equal(recommendRoute(source, alternatives, graph, defaults).alternative.zoneId, 'Gazebo');
  const unavailable = alternatives.map(z => z.zoneId === 'North' ? z : { ...z, population: 200, capacity: 200 });
  assert.equal(recommendRoute(source, unavailable, graph, defaults).alternative, null);
});

test('metric/event retention is bounded and configuration survives reads', () => {
  const f = fixture();
  for (let i = 0; i < 300; i++) f.tick(i % 2 ? 94 : 35);
  assert.equal(f.read().observations.length, 120);
  assert.equal(f.read().history.length, 100);
  assert.equal(f.read().notifications.length, 100);
  const total = f.read().observations.length;
  f.read(); f.read();
  assert.equal(f.read().observations.length, total);
});

test('monitoring HTTP routes validate inputs and do not mutate on invalid requests', async t => {
  const express = require('express');
  const app = express();
  const f = fixture();
  app.use(express.json());
  registerMonitoringRoutes(app, f.simulator);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}/api/monitoring`;
  assert.equal((await fetch(`${base}/North`)).status, 200);
  assert.equal((await fetch(`${base}/Unknown`)).status, 400);
  const send = (path, body, method = 'POST') => fetch(`${base}/${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal((await send('North/demo', { scenario: 'surge' })).status, 200);
  assert.equal((await send('North/demo', { scenario: 'bad' })).status, 400);
  assert.equal(f.read().demo.scenario, 'surge');
  assert.equal((await send('North/ingestion', { paused: 'true' })).status, 400);
  assert.equal((await send('North/ingestion', { paused: true })).status, 200);
  assert.equal(f.read().ingestionPaused, true);
  assert.equal((await fetch(`${base}/Unknown/demo`, { method: 'DELETE' })).status, 400);
  assert.equal(f.read().demo.scenario, 'surge');
  assert.equal((await fetch(`${base}/North/demo`, { method: 'DELETE' })).status, 200);
  assert.equal(f.read().demo, null);
});
