function registerMonitoringRoutes(app, monitoring) {
  const respond = handler => (req, res) => {
    try {
      handler(req);
      res.json({ success: true, data: monitoring.snapshot(req.params.zoneId) });
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  };
  app.get('/api/monitoring/:zoneId', respond(() => {}));
  app.put('/api/monitoring/:zoneId/config', respond(req => monitoring.configure(req.params.zoneId, req.body)));
  app.post('/api/monitoring/:zoneId/demo', respond(req => monitoring.startDemo(req.params.zoneId, req.body?.scenario)));
  app.post('/api/monitoring/:zoneId/bookings/:bookingId/demo', respond(req => monitoring.startBookingDemo(req.params.zoneId, req.params.bookingId, req.body?.scenario)));
  app.delete('/api/monitoring/:zoneId/demo', respond(req => {
    monitoring.snapshot(req.params.zoneId); // Validate before modifying the shared demo.
    monitoring.stopDemo();
  }));
  app.post('/api/monitoring/:zoneId/ingestion', respond(req => {
    monitoring.snapshot(req.params.zoneId);
    if (typeof req.body?.paused !== 'boolean') throw new Error('paused must be true or false.');
    monitoring.pauseIngestion(req.body.paused);
  }));
}

module.exports = { registerMonitoringRoutes };
