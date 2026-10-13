const defaults = require('./config');
const { evaluateAlarm, recommendRoute } = require('./alarmEngine');
const { createSimulatedNotification } = require('./notificationService');

function bookingStatus(booking, time) {
  if (booking.status === 'cancelled') return 'cancelled';
  if (time >= new Date(booking.endTime).getTime()) return 'completed';
  return time >= new Date(booking.startTime).getTime() ? 'active' : 'upcoming';
}

function bookingSeverity(count, expected, capacity) {
  if (count > capacity) return 'CRITICAL';
  if (count > expected) return 'HIGH';
  return count >= expected * 0.8 ? 'MODERATE' : 'NORMAL';
}

// Booking metadata stays in the existing MongoDB Booking model. This module
// keeps an independent, bounded alarm/history for each event in backend memory.
function createBookingMonitoring({ zones, graph, now = Date.now, onNotification = () => {} }) {
  const records = new Map();
  let nextId = 0;
  let latestZones = [];
  const append = (list, entry) => {
    list.unshift({ id: `booking-${++nextId}`, ...entry });
    list.splice(defaults.eventLimit);
  };
  const changeState = (record, state, reason) => {
    if (record.alarm.state !== state) {
      append(record.history, { timestamp: new Date(now()).toISOString(), type: 'StateTransition', from: record.alarm.state, to: state, reason });
      if (state !== 'ALARM') record.criticalNotified = false;
    }
    record.alarm.state = state;
    record.alarm.reason = reason;
  };

  function refresh(record) {
    const status = bookingStatus(record.booking, now());
    record.status = status;
    if (status !== 'active') {
      const reason = status === 'upcoming' ? 'Armed for the scheduled event start. No attendance alarm before the booked time.'
        : `Booking ${status}; event monitoring stopped.`;
      changeState(record, 'INSUFFICIENT_DATA', reason);
    } else if (record.lastReceived !== null && now() - record.lastReceived >= defaults.missingDataAfterMs) {
      changeState(record, 'INSUFFICIENT_DATA', 'No fresh venue crowd observations for at least 20 seconds.');
    } else if (record.lastReceived === null) {
      record.alarm.reason = 'Event is active. Waiting for the next venue crowd observation.';
    }
  }

  function syncBookings(bookings) {
    const seen = new Set();
    bookings.forEach(raw => {
      const id = String(raw._id || raw.id || '');
      const zone = zones.find(z => z.id === raw.zoneId);
      const expected = Number(raw.expectedAttendance);
      if (!id || !zone || !Number.isInteger(expected) || expected < 1 ||
          !Number.isFinite(new Date(raw.startTime).getTime()) ||
          !(new Date(raw.endTime).getTime() > new Date(raw.startTime).getTime())) return;
      seen.add(id);
      const booking = { id, zoneId: zone.id, zoneName: zone.name, eventName: raw.eventName,
        organizer: raw.organizer, expectedAttendance: expected, capacity: zone.capacity,
        startTime: new Date(raw.startTime).toISOString(), endTime: new Date(raw.endTime).toISOString(), status: raw.status };
      const existing = records.get(id);
      if (existing) existing.booking = booking;
      else records.set(id, {
        booking, status: bookingStatus(booking, now()),
        alarm: { name: `BookingCrowdAlarm-${id}`, state: 'INSUFFICIENT_DATA', reason: 'Waiting for venue crowd data.',
          config: { ...defaults, threshold: Math.min(expected, zone.capacity), evaluationPeriods: 1 } },
        current: null, lastReceived: null, observations: [], history: [], notifications: [], criticalNotified: false,
      });
      refresh(records.get(id));
    });
    // The server supplies all non-cancelled bookings after save/cancel and startup.
    records.forEach((record, id) => {
      if (!seen.has(id)) { record.booking.status = 'cancelled'; refresh(record); }
    });
  }

  function checkFreshness() { records.forEach(refresh); }

  function observe(zoneData) {
    latestZones = zoneData;
    checkFreshness();
    records.forEach(record => {
      if (record.status !== 'active') return;
      const zone = zoneData.find(z => z.zoneId === record.booking.zoneId);
      if (!zone || !Number.isInteger(zone.population) || zone.population < 0) return;
      const { expectedAttendance, capacity } = record.booking;
      const previousState = record.alarm.state;
      const severity = bookingSeverity(zone.population, expectedAttendance, capacity);
      const evaluated = evaluateAlarm([{ crowdCount: zone.population }], record.alarm.config);
      const reasons = [];
      if (zone.population > expectedAttendance) reasons.push(`Venue crowd ${zone.population} exceeds planned attendance ${expectedAttendance} by ${zone.population - expectedAttendance}.`);
      if (zone.population > capacity) reasons.push(`Venue capacity ${capacity} exceeded by ${zone.population - capacity}.`);
      const reason = reasons.length ? reasons.join(' ') : `Venue crowd ${zone.population} is within planned attendance ${expectedAttendance} and capacity ${capacity}.`;
      changeState(record, evaluated.state, reason);
      record.lastReceived = now();
      record.current = { crowdCount: zone.population, severity, timestamp: new Date(now()).toISOString(),
        source: zone.metricSource || 'Existing crowd simulator' };
      record.observations.push({ ...record.current, location: zone.zoneName, alarmState: record.alarm.state });
      record.observations = record.observations.slice(-defaults.historyLimit);
      const entered = record.alarm.state === 'ALARM' && previousState !== 'ALARM';
      const escalated = record.alarm.state === 'ALARM' && !entered && severity === 'CRITICAL' && !record.criticalNotified;
      if (entered || escalated) {
        const notification = createSimulatedNotification({ id: `booking-${++nextId}`, timestamp: record.current.timestamp,
          zone, alarm: record.alarm, severity, trigger: entered ? `${previousState} → ALARM` : 'Venue capacity escalation to CRITICAL',
          booking: record.booking,
          recommendation: recommendRoute(zone, zoneData, graph, defaults, severity),
        });
        record.notifications.unshift(notification);
        record.notifications.splice(defaults.eventLimit);
        if (severity === 'CRITICAL') record.criticalNotified = true;
        onNotification(notification);
      }
    });
  }

  function getBooking(id) {
    const record = records.get(String(id));
    if (!record) throw new Error('Saved booking not found in monitoring.');
    refresh(record);
    return { ...record.booking, status: record.status, current: record.current };
  }

  function snapshot(zoneId) {
    checkFreshness();
    return Array.from(records.values()).filter(r => r.booking.zoneId === zoneId)
      .sort((a, b) => new Date(a.booking.startTime) - new Date(b.booking.startTime))
      .map(record => {
        const fresh = record.status === 'active' && record.lastReceived !== null && now() - record.lastReceived < defaults.missingDataAfterMs;
        const zone = fresh ? latestZones.find(z => z.zoneId === record.booking.zoneId) : null;
        return {
          ...record.booking, status: record.status, alarm: record.alarm,
          metric: { namespace: defaults.namespace, name: 'CrowdCount', unit: 'Count', dimensions: { Location: record.booking.zoneName, BookingId: record.booking.id } },
          current: record.current ? { ...record.current, fresh } : null,
          observations: record.observations, history: record.history, notifications: record.notifications,
          recommendation: zone ? recommendRoute(zone, latestZones, graph, defaults, record.current.severity)
            : { alternative: null, message: 'Route advice requires an active event and fresh venue crowd data.' },
        };
      });
  }

  return { syncBookings, observe, checkFreshness, snapshot, getBooking };
}

module.exports = { createBookingMonitoring, bookingStatus, bookingSeverity };
