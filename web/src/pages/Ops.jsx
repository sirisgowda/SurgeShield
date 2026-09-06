import { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import { genMockTimeline, genMockSummary, genMockInvariants, injectMockChaos } from '../lib/mockData';
import ModeBadge from '../components/ModeBadge';
import StatTile from '../components/StatTile';
import SurgeCharts from '../components/SurgeCharts';
import Timeline from '../components/Timeline';
import InvariantPanel from '../components/InvariantPanel';
import ChaosPanel from '../components/ChaosPanel';

// D2: "Never wait for real data." Default to mock until D9, then flip
// VITE_USE_MOCK=false to switch to live polling of /api/ops/timeline.
const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false';

export default function Ops() {
  const [timeline, setTimeline] = useState({ events: [], series: [], scale: [] });
  const [summary, setSummary] = useState(null);
  const mockState = useRef({});

  useEffect(() => {
    let alive = true;

    async function tick() {
      try {
        if (USE_MOCK) {
          const data = genMockTimeline(mockState.current);
          if (!alive) return;
          setTimeline(data);
          setSummary(genMockSummary(mockState.current));
        } else {
          const data = await api('/api/ops/timeline?minutes=10');
          // D9: timestamps arrive as strings — parse them.
          const events = data.events.map(e => ({ ...e, ts: new Date(e.ts) }));
          const series = data.series.map(s => ({
            ...s, t: new Date(s.t).toLocaleTimeString('en-GB'),
          }));
          if (!alive) return;
          setTimeline({ ...data, events, series });
          const s = await api('/api/ops/summary');
          if (alive) setSummary(s);
        }
      } catch (err) {
        console.error('ops poll failed', err);
      }
    }

    tick();
    const id = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // D9: memoise the data array so charts don't re-mount (and jitter) on every poll.
  const series = useMemo(() => timeline.series, [timeline.series]);
  const markers = useMemo(() => timeline.events
    .filter(e => ['MODE_CHANGE', 'BREAKER_OPEN', 'BREAKER_CLOSED'].includes(e.action))
    .map(e => ({
      t: e.ts instanceof Date ? e.ts.toLocaleTimeString('en-GB') : new Date(e.ts).toLocaleTimeString('en-GB'),
      short: e.action,
    })), [timeline.events]);

  const currentMode = timeline.events.find(e => e.action === 'MODE_CHANGE')?.payload?.mode ?? 'NORMAL';

  function handleMockChaos(btn) {
    injectMockChaos(mockState.current, btn);
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Surge Story</h1>
        <ModeBadge mode={currentMode} />
      </div>

      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile label="Accepted" value={summary.accepted ?? 0} />
          <StatTile label="Confirmed" value={summary.confirmed ?? 0} tone="good" />
          <StatTile label="Duplicates absorbed" value={summary.duplicates ?? 0} />
          <StatTile label="Overbookings" value={summary.overbookings ?? 0} tone="good" />
          <StatTile label="Peak instances" value={summary.peak_instances ?? 0} />
          <StatTile label="Rejected" value={summary.rejected_5xx ?? 0} />
        </div>
      )}

      <InvariantPanel mock={USE_MOCK} data={USE_MOCK ? genMockInvariants() : undefined} />

      <ChaosPanel mock={USE_MOCK} onChaosEvent={handleMockChaos} />

      <SurgeCharts series={series} markers={markers} />

      <div className="border rounded-lg p-4">
        <div className="text-sm font-medium mb-2">Timeline</div>
        <Timeline events={timeline.events} />
      </div>
    </div>
  );
}
