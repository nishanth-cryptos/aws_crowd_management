// DA3 defaults: absolute people counts, independent of the dashboard's occupancy levels.
module.exports = {
  namespace: 'College/CrowdManagement',
  metricName: 'CrowdCount',
  unit: 'Count',
  comparison: 'GreaterThanThreshold',
  threshold: 70,
  evaluationPeriods: 1,
  sampleIntervalMs: 5000,
  missingDataAfterMs: 20000,
  historyLimit: 120,
  eventLimit: 100,
  levels: { moderate: 50, high: 70, critical: 90 },
  alternativeMaxOccupancy: 0.85,
};
