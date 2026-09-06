import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import Async from '../components/Async';

export default function MyRegistrations() {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRegs(await api('/api/events/me/registrations'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4 space-y-4">
      <h1 className="text-xl font-semibold">My registrations</h1>
      <Async
        loading={loading}
        error={error}
        onRetry={load}
        empty={regs.length === 0 ? "You haven't registered for anything yet." : null}
      >
        <ul className="space-y-3">
          {regs.map((r) => (
            <li key={r.id} className="border rounded-lg p-4">
              <p className="font-medium">{r.title}</p>
              <p className="text-sm text-slate-500">{new Date(r.starts_at).toLocaleString()}</p>
              <p className="text-sm mt-1">
                Status: <span className="font-medium">{r.status}</span>
                {r.reason_code && <span className="text-slate-400"> ({r.reason_code})</span>}
              </p>
              {r.event_mode === 'virtual' && r.join_url && r.status === 'CONFIRMED' && (
                <a className="text-sm underline" href={r.join_url} target="_blank" rel="noreferrer">
                  Join link
                </a>
              )}
            </li>
          ))}
        </ul>
      </Async>
    </div>
  );
}
