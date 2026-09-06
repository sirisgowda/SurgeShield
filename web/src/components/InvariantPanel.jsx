import { useEffect, useState } from 'react';
import { api } from '../lib/api';

// mock/data props let Ops.jsx feed this from mockData.js before B's real
// /api/ops/invariants endpoint exists — see D2's "never wait for real data".
export default function InvariantPanel({ mock = false, data }) {
  const [inv, setInv] = useState(mock ? data : null);

  useEffect(() => {
    if (mock) { setInv(data); return; }
    const f = () => api('/api/ops/invariants').then(setInv).catch(() => {});
    f();
    const id = setInterval(f, 2000);
    return () => clearInterval(id);
  }, [mock, data]);

  if (!inv) return null;
  return (
    <div className={`rounded-lg p-4 border-2 ${inv.ok
      ? 'border-green-500 bg-green-50' : 'border-red-500 bg-red-50'}`}>
      <div className="flex items-center gap-2 font-semibold">
        <span className={`w-2.5 h-2.5 rounded-full ${inv.ok ? 'bg-green-500' : 'bg-red-500'}`} />
        {inv.ok ? 'All invariants holding' : 'INVARIANT VIOLATED'}
      </div>
      <ul className="mt-2 space-y-0.5 text-xs">
        {inv.checks.map(c => (
          <li key={c.name} className={c.ok ? 'text-green-800' : 'text-red-800 font-medium'}>
            {c.ok ? '✓' : '✗'} {c.name.replace(/_/g, ' ')}
          </li>
        ))}
      </ul>
    </div>
  );
}
