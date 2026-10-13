// Local history entry only. No AWS SDK, SNS publish call, email or SMS is used.
function createSimulatedNotification({ id, timestamp, zone, alarm, severity, trigger, recommendation, booking }) {
  return {
    id, timestamp,
    label: 'Simulated SNS Notification',
    topic: 'CrowdAlerts (simulated topic)',
    subject: `${severity} ${booking ? 'BOOKING ' : ''}CROWD ALERT`,
    location: zone.zoneName,
    crowdCount: zone.population,
    threshold: alarm.config.threshold,
    alarmState: alarm.state,
    severity, trigger,
    message: recommendation.message,
    ...(booking ? { bookingId: booking.id, eventName: booking.eventName, zoneId: booking.zoneId,
      expectedAttendance: booking.expectedAttendance, capacity: booking.capacity, reason: alarm.reason } : {}),
  };
}

module.exports = { createSimulatedNotification };
