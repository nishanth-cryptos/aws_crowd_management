import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import BookingMonitoring from './BookingMonitoring';
import { Cloud, Bell, Activity, Navigation, ArrowRight, Play, Shield } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';

const panel = 'bg-slate-800/50 backdrop-blur border border-slate-700 rounded-xl p-5';
const input = 'bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white w-full';
const button = 'px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed';
const colors = {
  NORMAL: 'text-emerald-400', MODERATE: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400',
  OK: 'text-emerald-400', ALARM: 'text-red-400', INSUFFICIENT_DATA: 'text-slate-400',
};
const time = timestamp => new Date(timestamp).toLocaleTimeString('en-IN', { hour12: false });

export default function AWSMonitoring({ apiUrl, initialZoneId = 'North', selectedBookingId }) {
  const [zoneId, setZoneId] = useState(initialZoneId);
  useEffect(() => { setZoneId(initialZoneId); }, [initialZoneId]);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(null);
  const revision = useRef(0);
  const endpoint = `${apiUrl}/monitoring/${encodeURIComponent(zoneId)}`;

  // Read-only polling does not create observations or notifications. It also works
  // when the original dashboard switches from WebSocket to HTTP polling.
  useEffect(() => {
    let active = true;
    let timer;
    const controller = new AbortController();
    setData(null);
    setForm(null);
    setError('');
    setActionError('');
    const poll = async () => {
      const version = revision.current;
      try {
        const res = await axios.get(endpoint, { signal: controller.signal, timeout: 5000 });
        if (active && version === revision.current) {
          setData(res.data.data);
          setError('');
        }
      } catch (e) {
        if (active && !axios.isCancel(e)) setError('Monitoring backend unavailable. Check the backend and API URL; displayed data may be stale.');
      } finally {
        if (active) timer = setTimeout(poll, 1000);
      }
    };
    poll();
    return () => { active = false; controller.abort(); clearTimeout(timer); };
  }, [endpoint]);

  const config = data?.alarm.config;
  // Do not replace unsaved form edits on every poll (config objects are new each time).
  const configKey = config ? JSON.stringify(config) : '';
  const savedConfigKey = useRef('');
  useEffect(() => {
    if (config && savedConfigKey.current !== `${zoneId}:${configKey}`) {
      savedConfigKey.current = `${zoneId}:${configKey}`;
      setForm({ threshold: config.threshold, evaluationPeriods: config.evaluationPeriods,
        moderate: config.levels.moderate, high: config.levels.high, critical: config.levels.critical });
    }
  }, [zoneId, configKey, config]);

  const act = async (method, path, body) => {
    setBusy(true);
    setActionError('');
    revision.current += 1;
    try {
      const res = await axios({ method, url: `${endpoint}${path}`, data: body, timeout: 5000 });
      revision.current += 1;
      setData(res.data.data);
      setError('');
    } catch (e) {
      setActionError(e.response?.data?.error || 'Could not update monitoring. Check the backend connection.');
    } finally { setBusy(false); }
  };

  if (!data) return (
    <section className={panel}>
      <h2 className="text-xl font-semibold flex items-center gap-2"><Cloud className="text-blue-400" /> AWS Monitoring</h2>
      <p className="text-slate-400 mt-3" role="status">{error || 'Loading CloudWatch simulation…'}</p>
    </section>
  );

  const { current, alarm, metric, observations, history, notifications, recommendation, demo } = data;
  const location = metric.dimensions.Location;
  const levels = alarm.config.levels;
  const chart = observations.slice(-40).map(p => ({ ...p, time: time(p.timestamp) }));
  const blocked = busy || !!error;
  const demoLocation = data.locations.find(z => z.id === demo?.zoneId)?.name;

  return (
    <section className="space-y-5 animate-fade-in" aria-label="AWS Monitoring">
      <div className={`${panel} flex flex-wrap items-center justify-between gap-4`}>
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><Cloud className="text-blue-400" /> AWS Monitoring</h2>
          <p className="text-slate-400 text-sm mt-2">Intelligent crowd monitoring and alerts</p>
        </div>
        <label className="text-sm text-slate-300 min-w-[180px]">
          Campus location
          <select aria-label="Campus location" className={`${input} mt-1`} value={zoneId} disabled={busy} onChange={e => setZoneId(e.target.value)}>
            {data.locations.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
      </div>

      {(error || actionError) && <p role="alert" className="bg-red-900/30 border border-red-500/40 text-red-300 p-4 rounded-xl">{error || actionError}</p>}

      <ol className="grid grid-cols-1 sm:grid-cols-5 gap-2" aria-label="Monitoring workflow">
        {[
          ['Crowd Detection', 'Existing population'], ['CloudWatch Metric', 'CrowdCount'],
          ['Alarm Evaluation', `${alarm.config.evaluationPeriods}/${alarm.config.evaluationPeriods} observations`],
          ['SNS Notification', 'On alarm transition'], ['Route Recommendation', 'Connected alternative'],
        ].map(([title, detail], i) => (
          <li key={title} className="bg-slate-800/60 border border-slate-700 rounded-lg p-3 flex justify-between items-center gap-2">
            <div><p className="text-sm font-semibold">{i + 1}. {title}</p><p className="text-xs text-slate-400 mt-1">{detail}</p></div>
            {i < 4 && <ArrowRight className="w-4 h-4 text-blue-400 shrink-0 hidden sm:block" />}
          </li>
        ))}
      </ol>

      <BookingMonitoring bookings={data.bookings} selectedBookingId={selectedBookingId}
        demo={demo} blocked={blocked} onAction={act} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className={panel}>
          <h3 className="text-slate-300 font-semibold">Current Crowd · {location}</h3>
          <p className="text-5xl font-bold mt-4" aria-label="Current crowd count">{current?.crowdCount ?? '—'}<span className="text-sm text-slate-400 font-normal ml-2">people</span></p>
          <p className={`font-semibold mt-3 ${colors[current?.severity] || 'text-slate-400'}`}>{current?.severity || 'Waiting for data'}</p>
          <p className="text-xs text-slate-400 mt-2">{current?.source || 'Existing crowd simulator'}</p>
          <p className="text-xs text-slate-500 mt-2">{current ? `Last observation ${time(current.timestamp)}${!current.fresh || error ? ' · STALE' : ''}` : 'First observation arrives on the next update.'}</p>
        </div>
        <div className={panel}>
          <h3 className="font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-blue-400" /> CloudWatch Metric</h3>
          <dl className="text-sm space-y-2 mt-4">
            {[
              ['Namespace', metric.namespace], ['Metric', metric.name], ['Dimension', `Location = ${location}`],
              ['Unit', metric.unit], ['Current Value', current?.crowdCount ?? '—'], ['Comparison', `CrowdCount > ${alarm.config.threshold}`],
            ].map(([key, value]) => <div key={key} className="flex justify-between gap-3"><dt className="text-slate-400">{key}</dt><dd className="text-right break-words">{value}</dd></div>)}
          </dl>
        </div>
        <div className={`${panel} ${alarm.state === 'ALARM' ? 'border-red-500/50' : ''}`} aria-live="polite">
          <h3 className="font-semibold flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" /> CloudWatch Alarm</h3>
          <p className="text-xs text-slate-400 mt-2">{alarm.name}</p>
          <p className={`text-2xl font-bold mt-4 ${colors[alarm.state]}`}>{alarm.state}</p>
          <p className="text-sm text-slate-300 mt-3">{alarm.reason}</p>
          <p className="text-xs text-slate-500 mt-3">Action: record a Simulated SNS Notification on entry to ALARM.</p>
        </div>
      </div>

      <div className={panel}>
        <h3 className="font-semibold flex items-center gap-2"><Play className="w-4 h-4 text-blue-400" /> Crowd Controls</h3>
        <p className="text-sm text-slate-400 mt-2">Adjust crowd levels for this location and its active bookings.</p>
        <div className="flex flex-wrap gap-2 mt-4">
          {[
            ['normal', 'Simulate Normal Crowd', 'bg-emerald-700 hover:bg-emerald-600'],
            ['surge', 'Simulate Crowd Surge', 'bg-orange-700 hover:bg-orange-600'],
            ['critical', 'Simulate Critical Crowd', 'bg-red-700 hover:bg-red-600'],
            ['normalize', 'Normalize Crowd', 'bg-blue-700 hover:bg-blue-600'],
          ].map(([scenario, label, style]) => <button key={scenario} disabled={blocked} className={`${button} ${style}`} onClick={() => act('post', '/demo', { scenario })}>{label}</button>)}
          <button disabled={blocked || !demo} className={`${button} bg-slate-700 hover:bg-slate-600`} onClick={() => act('delete', '/demo')}>Resume live updates</button>
        </div>
        {demo && <div className="bg-blue-900/20 border border-blue-500/30 p-3 rounded-lg mt-4 text-sm" role="status">
          <p className="text-blue-300 font-semibold">Crowd scenario · {demoLocation} · {demo.scenario} · {demo.holding ? 'Holding final value' : `Step ${demo.step}/${demo.total}`}</p>
          <p className="text-slate-300 mt-1">{demo.values.join(' → ')}</p>
          <p className="text-slate-400 text-xs mt-2">Simulated alternatives: {Object.entries(demo.alternatives).map(([id, count]) => `${data.locations.find(z => z.id === id)?.name || id}: ${count}`).join(' · ')}</p>
        </div>}
        <div className="flex flex-wrap items-center gap-3 mt-4 border-t border-slate-700 pt-4">
          <button disabled={blocked} className={`${button} bg-slate-700 hover:bg-slate-600`} onClick={() => act('post', '/ingestion', { paused: !data.ingestionPaused })}>{data.ingestionPaused ? 'Resume metric ingestion' : 'Pause metric ingestion'}</button>
          <p className="text-xs text-slate-400">{data.ingestionPaused ? 'Ingestion paused. After 20 seconds the alarm enters INSUFFICIENT_DATA.' : 'Pausing metric updates for 20 seconds changes the alarm to INSUFFICIENT_DATA.'}</p>
        </div>
      </div>

      <div className={`${panel} border-blue-500/30`}>
        <h3 className="font-semibold flex items-center gap-2"><Navigation className="w-4 h-4 text-blue-400" /> Crowd Severity & Route Recommendation</h3>
        <p className="text-lg text-blue-200 mt-3">{error ? 'Waiting for the monitoring connection before recommending a route.' : recommendation.message}</p>
        {!error && recommendation.alternative && <p className="text-xs text-slate-400 mt-2">Alternative data: {recommendation.alternative.source}. A directly connected zone is ranked by crowd count and must be below {alarm.config.alternativeMaxOccupancy * 100}% occupancy.</p>}
        <div className="flex flex-wrap gap-4 text-xs mt-4">
          {[['NORMAL', `0–${levels.moderate - 1}`], ['MODERATE', `${levels.moderate}–${levels.high - 1}`], ['HIGH', `${levels.high}–${levels.critical - 1}`], ['CRITICAL', `${levels.critical}+`]].map(([level, range]) => <span key={level} className={colors[level]}>{level}: {range}</span>)}
        </div>
        <p className="text-xs text-slate-500 mt-3">Severity uses crowd counts; dashboard statuses use venue occupancy. At exactly the alarm threshold, the strict “greater than” comparison is OK.</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className={`${panel} xl:col-span-2`}>
          <h3 className="font-semibold mb-4">Metric History · CrowdCount</h3>
          {chart.length ? <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chart} margin={{ top: 15, right: 25, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} domain={[0, max => Math.max(max, alarm.config.threshold + 15)]} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
              <ReferenceLine y={alarm.config.threshold} stroke="#ef4444" strokeDasharray="5 3" label={{ value: `Threshold ${alarm.config.threshold}`, fill: '#f87171', position: 'insideTopRight', fontSize: 11 }} />
              <Line dataKey="crowdCount" name="CrowdCount" type="linear" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer> : <p className="text-slate-400 py-12">Waiting for observations…</p>}
          <p className="text-xs text-slate-500 mt-2">Last 40 observations plotted; last 120 stored per location. Red line shows the current configured threshold.</p>
        </div>
        <form className={panel} onSubmit={e => { e.preventDefault(); act('put', '/config', form); }}>
          <h3 className="font-semibold">Alarm Configuration</h3>
          <p className="text-xs text-slate-400 mt-2 mb-3">Applies to {location}. Saving starts a new evaluation window and preserves history.</p>
          {form && <div className="space-y-3">
            {[
              ['threshold', 'Alarm threshold', 0, 1000000], ['evaluationPeriods', 'Consecutive observations (N of N)', 1, 5],
              ['moderate', 'MODERATE begins at', 1, 1000000], ['high', 'HIGH begins at', 2, 1000000], ['critical', 'CRITICAL begins at', 3, 1000000],
            ].map(([key, label, min, max]) => <label key={key} className="block text-xs text-slate-400">{label}<input aria-label={label} className={`${input} mt-1`} type="number" required min={min} max={max} step="1" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value === '' ? '' : Number(e.target.value) }))} /></label>)}
            <button disabled={blocked} className={`${button} bg-blue-600 hover:bg-blue-700 w-full`} type="submit">Save configuration</button>
          </div>}
          <p className="text-xs text-slate-500 mt-3">Simplified sample evaluation, not AWS period aggregation. Missing-data policy: missing after 20 seconds.</p>
        </form>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={panel}>
          <h3 className="font-semibold mb-3">Alarm History <span className="text-slate-500 text-xs">({history.length})</span></h3>
          <div className="max-h-72 overflow-y-auto space-y-2">
            {!history.length && <p className="text-slate-400 text-sm">No transitions yet. Initial state: INSUFFICIENT_DATA.</p>}
            {history.map(event => <div key={event.id} className="bg-slate-900/50 rounded-lg p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-2"><span className="font-semibold">{event.type === 'ConfigurationUpdate' ? 'Configuration updated' : <>{event.from} → <span className={colors[event.to]}>{event.to}</span></>}</span><time className="text-xs text-slate-500">{time(event.timestamp)}</time></div>
              <p className="text-xs text-slate-400 mt-1">{event.reason}</p>
            </div>)}
          </div>
        </div>
        <div className={panel}>
          <h3 className="font-semibold flex items-center gap-2 mb-3"><Bell className="w-4 h-4 text-yellow-400" /> SNS Notification History <span className="text-slate-500 text-xs">({notifications.length})</span></h3>
          <div className="max-h-72 overflow-y-auto space-y-2" aria-live="polite">
            {!notifications.length && <p className="text-slate-400 text-sm">No notifications yet. Enter ALARM to trigger the simulated action.</p>}
            {notifications.map(n => <div key={n.id} className="bg-red-900/10 border border-red-500/30 rounded-lg p-3 text-sm">
              <div className="flex justify-between gap-2"><span className="text-yellow-300 text-xs font-semibold">{n.label}</span><time className="text-slate-500 text-xs">{time(n.timestamp)}</time></div>
              <p className={`font-semibold mt-2 ${colors[n.severity]}`}>{n.subject}</p>
              <p className="text-slate-300 mt-1">{n.location} · Crowd {n.crowdCount} · Threshold {n.threshold} · {n.alarmState}</p>
              <p className="text-slate-400 text-xs mt-1">{n.trigger}</p>
              <p className="text-blue-200 mt-2">{n.message}</p>
            </div>)}
          </div>
          <p className="text-xs text-slate-500 mt-3">No repeated alerts while ALARM remains active. One additional notification is sent when the crowd reaches CRITICAL during an alarm episode.</p>
        </div>
      </div>

      <details className={panel}>
        <summary className="font-semibold cursor-pointer">Recent Observations · timestamp, location, count, severity, alarm state</summary>
        <div className="overflow-x-auto max-h-64 mt-4">
          <table className="w-full text-sm text-left"><thead className="text-slate-400"><tr>{['Time', 'Location', 'CrowdCount', 'Severity', 'Alarm State', 'Threshold', 'Source'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
            <tbody>{observations.slice().reverse().map((p, i) => <tr key={`${p.timestamp}-${i}`} className="border-t border-slate-700"><td className="p-2 whitespace-nowrap">{time(p.timestamp)}</td><td className="p-2">{p.location}</td><td className="p-2">{p.crowdCount}</td><td className={`p-2 ${colors[p.severity]}`}>{p.severity}</td><td className={`p-2 ${colors[p.alarmState]}`}>{p.alarmState}</td><td className="p-2">{p.threshold}</td><td className="p-2 text-slate-400">{p.source}</td></tr>)}</tbody>
          </table>
        </div>
      </details>

    </section>
  );
}
