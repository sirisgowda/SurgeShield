import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Async from '../components/Async';

const BADGE = {
  SCHEDULED: 'bg-slate-100 text-slate-700',
  REGISTRATION_OPEN: 'bg-green-100 text-green-800',
  SOLD_OUT: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-slate-100 text-slate-500',
};
const LABEL = {
  SCHEDULED: 'Opens soon',
  REGISTRATION_OPEN: 'Open now',
  SOLD_OUT: 'Sold out',
  CLOSED: 'Closed',
};

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvents(await api('/api/events'));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-2xl mx-auto mt-12 px-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Events</h1>
        <Link to="/ops" className="text-sm underline">Create event</Link>
      </div>

      <Async
        loading={loading}
        error={error}
        onRetry={load}
        empty={events.length === 0 ? 'No events yet — create the first one.' : null}
      >
        <ul className="space-y-3">
          {events.map((e) => (
            <li key={e.id}>
              <Link
                to={`/events/${e.id}`}
                className="block border rounded-lg p-4 hover:border-slate-400 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-sm text-slate-500">
                      {new Date(e.starts_at).toLocaleString()}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full whitespace-nowrap ${BADGE[e.status]}`}>
                    {LABEL[e.status]}
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </Async>
    </div>
  );
}
