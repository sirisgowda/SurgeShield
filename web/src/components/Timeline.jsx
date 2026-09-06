import { narrate } from '../lib/narrate';

const TONE = {
  good: 'text-green-700', bad: 'text-red-700',
  warn: 'text-amber-700', info: 'text-blue-700', muted: 'text-slate-500',
};

export default function Timeline({ events }) {
  return (
    <ol className="space-y-1.5 max-h-[420px] overflow-y-auto">
      {events.map((e, i) => {
        const n = narrate(e);
        const ts = e.ts instanceof Date ? e.ts : new Date(e.ts);
        return (
          <li key={e.correlation_id ?? i} className="flex gap-3 text-sm py-1.5 border-b border-slate-100">
            <span className="tabular-nums text-slate-400 text-xs w-16 shrink-0">
              {ts.toLocaleTimeString('en-GB')}
            </span>
            <span className={`${TONE[n.tone]} w-4 shrink-0`}>{n.icon}</span>
            <span className={TONE[n.tone]}>{n.text}</span>
          </li>
        );
      })}
    </ol>
  );
}
