// Ported from prasanna_branch. The mock prop is gone - this always reads the
// live /api/ops/invariants endpoint, which exists on main.
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function InvariantPanel({ intervalMs = 2000 }) {
  const [inv, setInv] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    let alive = true;
    const f = () => api('/api/ops/invariants')
      .then(d => { if (alive) { setInv(d); setErr(null); } })
      .catch(e => { if (alive) setErr(e.message || 'unreachable'); });
    f();
    const id = setInterval(f, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);

  if (err) {
    return (
      <div className="rounded-lg p-4 border-2 border-amber-500/40 bg-amber-500/10">
        <div className="font-semibold text-amber-300">Invariants unavailable</div>
        <div className="text-xs text-amber-200/70 mt-1">{err}</div>
      </div>
    );
  }
  if (!inv) return <div className="rounded-lg p-4 border border-[#2e2622] text-stone-500 text-sm">Loading invariants…</div>;

  const checks = inv.checks ?? [];
  return (
    <div className={`rounded-lg p-4 border-2 ${inv.ok
      ? 'border-green-500/50 bg-green-500/10' : 'border-red-500/60 bg-red-500/10'}`}>
      <div className="flex items-center gap-2 font-semibold text-white">
        <span className={`w-2.5 h-2.5 rounded-full ${inv.ok ? 'bg-green-500' : 'bg-red-500'}`} />
        {inv.ok ? 'All invariants holding' : 'INVARIANT VIOLATED'}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {checks.map(c => (
          <li key={c.name} className={c.ok ? 'text-green-300' : 'text-red-300 font-medium'}>
            {c.ok ? '✓' : '✗'} {String(c.name).replace(/_/g, ' ')}
            {!c.ok && c.violations != null ? ` (${c.violations})` : ''}
          </li>
        ))}
      </ul>
    </div>
  );
}
