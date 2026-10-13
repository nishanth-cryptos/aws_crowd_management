import React, { useEffect, useState } from 'react';
import { Calendar, Bell, Shield } from 'lucide-react';

const colors = { OK: 'text-emerald-400', ALARM: 'text-red-400', INSUFFICIENT_DATA: 'text-slate-400',
  NORMAL: 'text-emerald-400', MODERATE: 'text-yellow-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400' };
const button = 'px-3 py-2 rounded-lg text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed';
const date = value => new Date(value).toLocaleString('en-IN');
const time = value => new Date(value).toLocaleTimeString('en-IN', { hour12: false });

export default function BookingMonitoring({ bookings = [], selectedBookingId, demo, blocked, onAction }) {
  const [chosenId, setChosenId] = useState(selectedBookingId || '');
  useEffect(() => { if (selectedBookingId) setChosenId(selectedBookingId); }, [selectedBookingId]);
  const booking = bookings.find(b => b.id === chosenId) || bookings.find(b => b.status === 'active') ||
    bookings.find(b => b.status === 'upcoming') || bookings[bookings.length - 1];
  const demoForBooking = demo?.bookingId === booking?.id;
  const canSimulate = !blocked && booking?.status === 'active';

  return (
    <section className="bg-slate-800/50 backdrop-blur border border-blue-500/30 rounded-xl p-5 space-y-4" aria-label="Booked event monitoring">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-5 h-5 text-blue-400" /> Booked Event Monitoring</h3>
          <p className="text-xs text-slate-400 mt-2">Saved bookings are armed automatically. Crowd alarms run during each event's booked time.</p>
        </div>
        {booking && <label className="text-xs text-slate-400">Saved booking
          <select aria-label="Saved booking" value={booking.id} disabled={blocked} onChange={e => setChosenId(e.target.value)}
            className="block mt-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white max-w-full">
            {bookings.map(b => <option key={b.id} value={b.id}>{b.eventName} · {b.status} · {date(b.startTime)}</option>)}
          </select>
        </label>}
      </div>
      {!booking ? <p className="text-sm text-slate-400">No saved bookings for this location. Book a zone from the Crowd Dashboard to attach its event monitoring automatically.</p> : <>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <div><p className="font-semibold text-blue-200">{booking.eventName} · {booking.zoneName}</p><p className="text-slate-400 text-xs mt-1">{date(booking.startTime)} → {date(booking.endTime)}</p></div>
          <span className={`self-start px-3 py-1 rounded-full text-xs font-semibold ${booking.status === 'active' ? 'bg-emerald-900/40 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>
            {booking.status === 'active' ? 'ACTIVE · monitoring' : booking.status === 'upcoming' ? 'UPCOMING · armed' : `${booking.status.toUpperCase()} · monitoring stopped`}
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            ['Planned attendance', booking.expectedAttendance, 'text-white'],
            ['Current venue crowd', booking.current?.crowdCount ?? '—', colors[booking.current?.severity] || 'text-white'],
            ['Venue capacity', booking.capacity, 'text-white'],
            ['Booking alarm', booking.alarm.state, colors[booking.alarm.state]],
          ].map(([label, value, color]) => <div key={label} className="bg-slate-900/50 rounded-lg p-3">
            <p className="text-xs text-slate-400">{label}</p><p className={`text-xl font-bold mt-2 break-words ${color}`}>{value}</p>
          </div>)}
        </div>
        <p className="text-sm text-slate-300" aria-live="polite">{booking.alarm.reason}</p>
        <p className="text-xs text-slate-400">{booking.alarm.name} · CrowdCount · Location = {booking.zoneName} · BookingId = {booking.id}</p>
        <p className="text-xs text-slate-500">Venue crowd is an attendance estimate and can include other people in the zone. {booking.current && `Last sample ${time(booking.current.timestamp)}${!booking.current.fresh || blocked ? ' · last known / stale' : ''}.`}</p>

        <div className="bg-blue-900/15 rounded-lg p-3 text-sm text-blue-200">
          {blocked ? 'Waiting for the monitoring connection before recommending an event route.' : booking.recommendation.message}
        </div>

        <div className="border-t border-slate-700 pt-4">
          <p className="font-semibold text-sm mb-2">Event Crowd Controls</p>
          <div className="flex flex-wrap gap-2">
            {[
              ['within', 'Crowd within booking', 'bg-emerald-700 hover:bg-emerald-600'],
              ['surge', 'Simulate unexpected arrivals', 'bg-orange-700 hover:bg-orange-600'],
              ['capacity', 'Simulate capacity breach', 'bg-red-700 hover:bg-red-600'],
              ['normalize', 'Normalize event crowd', 'bg-blue-700 hover:bg-blue-600'],
            ].map(([scenario, label, style]) => <button key={scenario} disabled={!canSimulate} className={`${button} ${style}`}
              onClick={() => onAction('post', `/bookings/${encodeURIComponent(booking.id)}/demo`, { scenario })}>{label}</button>)}
            <button disabled={blocked || !demoForBooking} className={`${button} bg-slate-700 hover:bg-slate-600`} onClick={() => onAction('delete', '/demo')}>Return to live crowd</button>
          </div>
          <p className="text-xs text-slate-400 mt-2">{booking.status === 'upcoming' ? 'Crowd controls become available at the scheduled event start.'
            : booking.status !== 'active' ? 'Completed and cancelled bookings retain their session history; no new event alerts are generated.'
              : 'These controls change the same venue count used by the dashboard and alarm, once every five seconds.'}</p>
          {demoForBooking && <p className="text-xs text-blue-300 mt-2" role="status">Simulated booking crowd: {demo.values.join(' → ')} · {demo.holding ? 'Holding final crowd' : `Step ${demo.step}/${demo.total}`}</p>}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900/40 rounded-lg p-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Shield className="w-4 h-4 text-blue-400" /> Booking Alarm History ({booking.history.length})</h4>
            <div className="max-h-52 overflow-y-auto space-y-2 mt-3">
              {!booking.history.length && <p className="text-xs text-slate-400">Waiting for the event's first alarm evaluation.</p>}
              {booking.history.map(h => <div key={h.id} className="text-xs border-t border-slate-700 pt-2">
                <p>{time(h.timestamp)} · {h.from} → <span className={colors[h.to]}>{h.to}</span></p>
                <p className="text-slate-400 mt-1">{h.reason}</p>
              </div>)}
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-lg p-3">
            <h4 className="font-semibold text-sm flex items-center gap-2"><Bell className="w-4 h-4 text-yellow-400" /> Booking SNS History ({booking.notifications.length})</h4>
            <div className="max-h-52 overflow-y-auto space-y-2 mt-3" aria-live="polite">
              {!booking.notifications.length && <p className="text-xs text-slate-400">An active event's crowd exceeding planned attendance or capacity triggers its simulated SNS action.</p>}
              {booking.notifications.map(n => <div key={n.id} className="border border-red-500/30 bg-red-900/10 p-3 rounded-lg text-xs">
                <p className="text-yellow-300 font-semibold">{n.label} · {time(n.timestamp)}</p>
                <p className={`font-semibold mt-2 ${colors[n.severity]}`}>{n.subject} · {n.eventName}</p>
                <p className="text-slate-300 mt-1">Crowd {n.crowdCount} · Planned {n.expectedAttendance} · Capacity {n.capacity}</p>
                <p className="text-slate-400 mt-1">{n.trigger} · {n.reason}</p>
                <p className="text-blue-200 mt-2">{n.message}</p>
              </div>)}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-500">Each booking has a separate alarm from the location alarm below. Repeated ALARM samples are suppressed; exceeding capacity can generate one CRITICAL escalation. Booking alerts also appear in the existing alert bell.</p>
      </>}
    </section>
  );
}
