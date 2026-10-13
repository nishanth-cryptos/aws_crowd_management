const defaults = require('./config');
const { classifyCrowd, evaluateAlarm, recommendRoute } = require('./alarmEngine');
const { createSimulatedNotification } = require('./notificationService');
const { createBookingMonitoring } = require('./bookingMonitoring');

function createCloudWatchSimulator({ zones, graph, now = Date.now, onBookingNotification }) {
  let nextId = 0;
  let latestZones = [];
  let demo = null;
  let paused = false;
  const bookingMonitoring = createBookingMonitoring({ zones, graph, now, onNotification: onBookingNotification });
  const alarms = new Map(zones.map(zone => [zone.id, {
    name: `HighCrowdAlarm-${zone.id}`,
    state: 'INSUFFICIENT_DATA',
    reason: 'Waiting for crowd observations.',
    config: { ...defaults, levels: { ...defaults.levels } },
    observations: [], evaluation: [], history: [], notifications: [],
    lastReceived: null, lastZone: null, criticalNotified: false,
  }]));

  const getAlarm = id => {
    const alarm = alarms.get(id);
    if (!alarm) throw new Error('Unknown campus location.');
    return alarm;
  };
  const addEvent = (list, event) => {
    list.unshift({ id: ++nextId, ...event });
    list.splice(defaults.eventLimit);
  };
  const transition = (alarm, state, reason, timestamp) => {
    if (alarm.state !== state) {
      addEvent(alarm.history, { timestamp, type: 'StateTransition', from: alarm.state, to: state, reason });
      if (state !== 'ALARM') alarm.criticalNotified = false;
    }
    alarm.state = state;
    alarm.reason = reason;
  };

  function checkFreshness() {
    bookingMonitoring.checkFreshness();
    const time = now();
    alarms.forEach(alarm => {
      if (alarm.lastReceived !== null && time - alarm.lastReceived >= alarm.config.missingDataAfterMs) {
        transition(alarm, 'INSUFFICIENT_DATA', `No new crowd observations for at least ${alarm.config.missingDataAfterMs / 1000} seconds. Missing data is treated as missing.`, new Date(time).toISOString());
        alarm.evaluation = [];
      }
    });
  }

  function observe(zoneData) {
    checkFreshness();
    if (paused) return;
    latestZones = zoneData.filter(z => alarms.has(z.zoneId) && Number.isInteger(z.population) && z.population >= 0);
    const timestamp = new Date(now()).toISOString();
    latestZones.forEach(zone => {
      const alarm = getAlarm(zone.zoneId);
      const previousState = alarm.state;
      const severity = classifyCrowd(zone.population, alarm.config.levels);
      const datapoint = {
        timestamp, location: zone.zoneName, crowdCount: zone.population,
        severity, source: zone.metricSource || 'Existing crowd simulator',
      };
      alarm.evaluation.push(datapoint);
      alarm.evaluation = alarm.evaluation.slice(-alarm.config.evaluationPeriods);
      const evaluated = evaluateAlarm(alarm.evaluation, alarm.config);
      transition(alarm, evaluated.state, evaluated.reason, timestamp);
      alarm.lastReceived = now();
      alarm.lastZone = { ...zone };
      alarm.observations.push({ ...datapoint, alarmState: alarm.state, threshold: alarm.config.threshold });
      alarm.observations = alarm.observations.slice(-defaults.historyLimit);

      const enteredAlarm = alarm.state === 'ALARM' && previousState !== 'ALARM';
      const escalated = alarm.state === 'ALARM' && !enteredAlarm && severity === 'CRITICAL' && !alarm.criticalNotified;
      if (enteredAlarm || escalated) {
        const trigger = enteredAlarm ? `${previousState} → ALARM` : 'Severity escalation to CRITICAL';
        alarm.notifications.unshift(createSimulatedNotification({
          id: ++nextId, timestamp, zone, alarm, severity, trigger,
          recommendation: recommendRoute(zone, latestZones, graph, alarm.config),
        }));
        alarm.notifications.splice(defaults.eventLimit);
        if (severity === 'CRITICAL') alarm.criticalNotified = true;
      }
    });
    bookingMonitoring.observe(latestZones);
  }

  // Inject demo values into the ORIGINAL network generator, before DBSCAN.
  // Only the regular 5-second update advances the preset; Refresh cannot skip steps.
  function applyDemo(networkData, advance = false) {
    if (demo?.bookingId && bookingMonitoring.getBooking(demo.bookingId).status !== 'active') demo = null;
    if (!demo) return networkData;
    if (advance && demo.index < demo.values.length - 1) demo.index += 1;
    const count = demo.values[Math.max(0, demo.index)];
    return networkData.map(zone => {
      if (zone.zoneId === demo.zoneId) return { ...zone, population: count, metricSource: 'Crowd scenario (simulated)' };
      if (demo.alternatives[zone.zoneId] !== undefined) {
        return { ...zone, population: demo.alternatives[zone.zoneId], metricSource: 'Alternative scenario (simulated)' };
      }
      return zone;
    });
  }

  function startDemo(zoneId, scenario) {
    const alarm = getAlarm(zoneId);
    const current = alarm.lastZone?.population ?? 94;
    const presets = {
      normal: [35], surge: [35, 47, 59, 68, 76, 87, 94], critical: [94],
      normalize: [current, ...[87, 76, 68, 59, 47, 35].filter(n => n < current)],
    };
    if (!Object.prototype.hasOwnProperty.call(presets, scenario)) throw new Error('Unknown crowd scenario.');
    // A new scenario retains alarm/history state; recovery must be evaluated normally.
    const alternativeIds = Object.keys(graph[zoneId] || {}).sort().filter(id => alarms.has(id)).slice(-2);
    const alternatives = Object.fromEntries(alternativeIds.map((id, i) => [id, i === 0 ? 48 : 31]));
    demo = { zoneId, scenario, values: presets[scenario], index: -1, alternatives };
    paused = false;
  }

  function startBookingDemo(zoneId, bookingId, scenario) {
    const booking = bookingMonitoring.getBooking(bookingId);
    if (booking.zoneId !== zoneId) throw new Error('Booking belongs to a different campus location.');
    if (booking.status !== 'active') throw new Error('Crowd controls are available during the booked event time.');
    const expected = booking.expectedAttendance;
    const baseline = Math.floor(expected * 0.8);
    const current = getAlarm(zoneId).lastZone?.population ?? baseline;
    const presets = {
      within: [baseline],
      surge: [baseline, expected, expected + 1, expected + Math.max(2, Math.ceil(expected * 0.2))],
      capacity: [baseline, expected, booking.capacity, booking.capacity + Math.max(1, Math.ceil(booking.capacity * 0.1))],
      normalize: Array.from({ length: 6 }, (_, i) => Math.round(current + (baseline - current) * i / 5)),
    };
    if (!Object.prototype.hasOwnProperty.call(presets, scenario)) throw new Error('Unknown booking crowd scenario.');
    startDemo(zoneId, 'normal'); // Reuse the same generator override and alternative model.
    demo = { ...demo, bookingId: booking.id, scenario: `booking-${scenario}`, values: presets[scenario] };
  }

  function configure(zoneId, input) {
    const alarm = getAlarm(zoneId);
    const { threshold, evaluationPeriods, moderate, high, critical } = input || {};
    if (![threshold, evaluationPeriods, moderate, high, critical].every(Number.isInteger) ||
        threshold < 0 || threshold > 1000000 || evaluationPeriods < 1 || evaluationPeriods > 5 ||
        moderate < 1 || !(moderate < high && high < critical) || critical > 1000000) {
      throw new Error('Use whole numbers: threshold 0–1000000, evaluation observations 1–5, and 0 < MODERATE < HIGH < CRITICAL ≤ 1000000.');
    }
    alarm.config = { ...alarm.config, threshold, evaluationPeriods, levels: { moderate, high, critical } };
    alarm.evaluation = [];
    const timestamp = new Date(now()).toISOString();
    addEvent(alarm.history, { timestamp, type: 'ConfigurationUpdate', reason: `Threshold ${threshold}; evaluation ${evaluationPeriods}/${evaluationPeriods}; severity boundaries ${moderate}/${high}/${critical}.` });
    transition(alarm, 'INSUFFICIENT_DATA', 'Configuration updated. Waiting for new observations.', timestamp);
  }

  function snapshot(zoneId) {
    checkFreshness();
    const alarm = getAlarm(zoneId);
    const fresh = alarm.lastReceived !== null && now() - alarm.lastReceived < alarm.config.missingDataAfterMs;
    return {
      simulated: true,
      locations: zones.map(z => ({ id: z.id, name: z.name })),
      metric: { namespace: defaults.namespace, name: defaults.metricName, unit: defaults.unit, dimensions: { Location: zones.find(z => z.id === zoneId).name } },
      alarm: { name: alarm.name, state: alarm.state, reason: alarm.reason, config: alarm.config },
      current: alarm.lastZone ? {
        crowdCount: alarm.lastZone.population,
        severity: classifyCrowd(alarm.lastZone.population, alarm.config.levels),
        timestamp: new Date(alarm.lastReceived).toISOString(), fresh,
        source: alarm.lastZone.metricSource || 'Existing crowd simulator',
      } : null,
      recommendation: fresh && alarm.lastZone
        ? recommendRoute(alarm.lastZone, latestZones.filter(z => {
          const candidate = getAlarm(z.zoneId);
          return candidate.lastReceived !== null && now() - candidate.lastReceived < candidate.config.missingDataAfterMs;
        }), graph, alarm.config)
        : { alternative: null, message: 'Waiting for fresh crowd data before recommending a route.' },
      observations: alarm.observations,
      history: alarm.history,
      notifications: alarm.notifications,
      bookings: bookingMonitoring.snapshot(zoneId),
      ingestionPaused: paused,
      demo: demo ? { ...demo, step: Math.max(0, demo.index + 1), total: demo.values.length, holding: demo.index === demo.values.length - 1 } : null,
    };
  }

  return {
    observe, applyDemo, startDemo, startBookingDemo, configure, snapshot, checkFreshness,
    syncBookings: bookingMonitoring.syncBookings,
    stopDemo: () => { demo = null; paused = false; },
    pauseIngestion: value => { paused = value; },
  };
}

module.exports = { createCloudWatchSimulator };
