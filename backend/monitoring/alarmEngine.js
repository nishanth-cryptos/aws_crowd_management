function classifyCrowd(count, levels) {
  if (count >= levels.critical) return 'CRITICAL';
  if (count >= levels.high) return 'HIGH';
  if (count >= levels.moderate) return 'MODERATE';
  return 'NORMAL';
}

// A deliberately simplified N-of-N evaluation over consecutive observations.
// Actual CloudWatch aggregates time periods; this demo evaluates each 5-second sample.
function evaluateAlarm(samples, config) {
  const window = samples.slice(-config.evaluationPeriods);
  if (window.length < config.evaluationPeriods) {
    return {
      state: 'INSUFFICIENT_DATA',
      reason: `Received ${window.length}/${config.evaluationPeriods} required observations.`,
    };
  }
  const breaches = window.filter(p => p.crowdCount > config.threshold).length;
  const state = breaches === config.evaluationPeriods ? 'ALARM' : 'OK';
  const current = window[window.length - 1].crowdCount;
  return {
    state,
    reason: config.evaluationPeriods === 1
      ? `CrowdCount ${current} ${current > config.threshold ? '>' : '≤'} threshold ${config.threshold}.`
      : `${breaches}/${config.evaluationPeriods} observations exceed ${config.threshold}; ${config.evaluationPeriods}/${config.evaluationPeriods} required for ALARM. Latest CrowdCount: ${current}.`,
  };
}

// Only directly connected campus zones with a lower count and spare capacity qualify.
function recommendRoute(source, zones, graph, config, severity = classifyCrowd(source.population, config.levels)) {
  if (!['HIGH', 'CRITICAL'].includes(severity)) {
    return { alternative: null, message: 'Continue using this zone. No crowd redirection is needed.' };
  }
  const candidates = zones.filter(z =>
    Object.prototype.hasOwnProperty.call(graph[source.zoneId] || {}, z.zoneId) &&
    Number.isFinite(z.population) && z.population >= 0 && z.capacity > 0 &&
    z.population < source.population &&
    z.population / z.capacity < config.alternativeMaxOccupancy
  ).sort((a, b) => a.population - b.population || a.zoneId.localeCompare(b.zoneId));
  const alternative = candidates[0];
  if (!alternative) {
    return { alternative: null, message: 'No less crowded connected zone with spare capacity is available. Ask campus staff to manage entry.' };
  }
  return {
    alternative: {
      zoneId: alternative.zoneId,
      location: alternative.zoneName,
      crowdCount: alternative.population,
      occupancy: Math.round(alternative.population / alternative.capacity * 100),
      source: alternative.metricSource || 'Existing crowd simulator',
    },
    message: `Use ${alternative.zoneName} — current crowd ${alternative.population} (${Math.round(alternative.population / alternative.capacity * 100)}% full). ${severity === 'CRITICAL' ? 'Ask campus staff to redirect students and manage entry.' : 'Redirect arriving students to this connected zone.'}`,
  };
}

module.exports = { classifyCrowd, evaluateAlarm, recommendRoute };
