// Ported from prasanna_branch, restyled to main's dark palette.
import { narrate } from '../lib/narrate';

const TONE = {
  good: 'text-green-400', bad: 'text-red-400',
  warn: 'text-amber-400', info: 'text-blue-400', muted: 'text-stone-400',
};

export default function Timeline({ events = [] }) {
  if (!events.length) {
    return <p className="text-sm text-stone-500 py-4">No activity in this window yet.</p>;
  }
  return (
    <ol className="space-y-1.5 max-h-[420px] overflow-y-auto pr-1">
      {events.map((e, i) => {
        const n = narrate(e);
        const ts = e.ts instanceof Date ? e.ts : new Date(e.ts);
        return (
          <li key={`${e.correlation_id ?? 'row'}-${i}`}
              className="flex gap-3 text-sm py-1.5 border-b border-[#221c19]">
            <span className="tabular-nums text-stone-500 text-xs w-16 shrink-0">
              {isNaN(ts) ? '--:--:--' : ts.toLocaleTimeString('en-GB')}
            </span>
            <span className={`${TONE[n.tone] ?? TONE.muted} w-4 shrink-0`}>{n.icon}</span>
            <span className={TONE[n.tone] ?? TONE.muted}>{n.text}</span>
          </li>
        );
      })}
    </ol>
  );
}
