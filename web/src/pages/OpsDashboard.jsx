// Ops dashboard — ported from prasanna_branch's Ops.jsx.
//
// TWO DELIBERATE CHANGES FROM THE ORIGINAL, both to make it safe to show:
//
//  1. NEW FILE NAME. main's pages/Ops.jsx is the organiser's event-creation
//     form, a completely different page. Overwriting it would have deleted the
//     form the demo uses to create events. This lives alongside it at
//     /ops/dashboard.
//
//  2. NO MOCK MODE. The original defaulted to generated fake data
//     (`const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'`) — so
//     unless VITE_USE_MOCK=false was set at build time it would show judges
//     invented numbers that look exactly like real ones. That default is a
//     liability on stage, so the mock path and lib/mockData.js are not ported.
//     This reads live endpoints only and says so plainly when they are down.

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import ModeBadge from '../components/ModeBadge';
import StatTile from '../components/StatTile';
import SurgeCharts from '../components/SurgeCharts';
import Timeline from '../components/Timeline';
import InvariantPanel from '../components/InvariantPanel';

const POLL_MS = 2000;
const WINDOW_MINUTES = 10;

export default function OpsDashboard() {
  const [timeline, setTimeline] = useState({ events: [], series: [], scale: [] });
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState(null);
  const [lastOk, setLastOk] = useState(null);

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        const [t, s] = await Promise.all([
          api(`/api/ops/timeline?minutes=${WINDOW_MINUTES}`),
          api('/api/ops/summary'),
        ]);
        if (!alive) return;
        setTimeline({
          events: t?.events ?? [],
          series: t?.series ?? [],
          scale: t?.scale ?? [],
        });
        setSummary(s ?? null);
        setError(null);
        setLastOk(new Date());
      } catch (e) {
        if (alive) setError(e?.message || 'ops endpoints unreachable');
      }
    }

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // Annotate the charts wherever the system changed behaviour.
  const markers = useMemo(
    () => (timeline.events ?? [])
      .filter(e => ['MODE_CHANGE', 'SCALE', 'BREAKER_OPEN', 'BREAKER_CLOSED'].includes(e.action))
      .map(e => ({ t: e.ts, short: e.action.replace('BREAKER_', '').toLowerCase() }))
      .slice(0, 12),
    [timeline.events],
  );

  const mode = useMemo(() => {
    const last = (timeline.events ?? []).find(e => e.action === 'MODE_CHANGE');
    return last?.payload?.mode ?? 'NORMAL';
  }, [timeline.events]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Operations
          </h1>
          <p className="text-sm text-stone-400 mt-1">
            Live from <code className="text-stone-300">decision_log</code> · last {WINDOW_MINUTES} minutes ·
            refreshing every {POLL_MS / 1000}s
          </p>
        </div>
        <div className="flex items-center gap-3">
          <ModeBadge mode={mode} />
          <span className="text-xs text-stone-500">
            {lastOk ? `updated ${lastOk.toLocaleTimeString('en-GB')}` : 'connecting…'}
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded-lg p-3 border border-amber-500/40 bg-amber-500/10 text-amber-200 text-sm">
          Ops endpoints unreachable — showing the last successful read. ({error})
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatTile label="Accepted"    value={summary?.accepted} />
        <StatTile label="Confirmed"   value={summary?.confirmed}  tone="good" />
        <StatTile label="Denied"      value={summary?.denied} />
        <StatTile label="Duplicates"  value={summary?.duplicates} sub="absorbed" />
        <StatTile label="Overbookings" value={summary?.overbookings ?? 0}
                  tone={summary?.overbookings ? 'bad' : 'good'} sub="must stay 0" />
      </div>

      <InvariantPanel />

      <div className="grid lg:grid-cols-2 gap-6">
        <section>
          <h2 className="text-lg font-bold text-white mb-3 border-b border-[#2e2622] pb-2">
            Throughput
          </h2>
          <SurgeCharts series={timeline.series} scale={timeline.scale} markers={markers} />
        </section>
        <section>
          <h2 className="text-lg font-bold text-white mb-3 border-b border-[#2e2622] pb-2">
            What the system did
          </h2>
          <Timeline events={timeline.events} />
        </section>
      </div>
    </div>
  );
}
