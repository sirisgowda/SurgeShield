import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../lib/api';
import Async from '../components/Async';

const LABEL = {
  SCHEDULED: 'Opens soon',
  REGISTRATION_OPEN: 'Open now',
  SOLD_OUT: 'Sold out',
  CLOSED: 'Closed',
};

function useCountdown(target) {
  const [msLeft, setMsLeft] = useState(() => new Date(target) - new Date());
  useEffect(() => {
    const id = setInterval(() => setMsLeft(new Date(target) - new Date()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return msLeft;
}

function formatCountdown(ms) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}

export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEvent(await api(`/api/events/${id}`));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const msLeft = useCountdown(event?.registration_opens_at ?? Date.now());
  const countdown = event?.status === 'SCHEDULED' ? formatCountdown(msLeft) : null;

  return (
    <div className="max-w-xl mx-auto mt-12 px-4">
      <Async loading={loading} error={error} onRetry={load}>
        {event && (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-semibold">{event.title}</h1>
              <p className="text-sm text-slate-500">
  {event.starts_at ? new Date(event.starts_at).toLocaleString() : 'Date TBD'}
</p>
            </div>

            {event.description && <p className="text-slate-700">{event.description}</p>}

            <div className="text-sm text-slate-600">
              {event.event_mode === 'virtual' ? (
                <p>Virtual event — join link shared on registration.</p>
              ) : (
                <p>Venue: {event.venue}</p>
              )}
              <p>{event.seats_left} seat{event.seats_left === 1 ? '' : 's'} left</p>
            </div>

            {countdown && (
              <div className="p-3 bg-slate-50 border rounded-lg text-sm">
                Registration opens in <span className="font-mono">{countdown}</span>
              </div>
            )}

            <div className="p-3 border rounded-lg">
              <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">
                {LABEL[event.status]}
              </p>
              {/*
                Registration slot: D wires up the register/cancel button here.
                Expected props: eventId={event.id}, status={event.status},
                seatsLeft={event.seats_left}, onRegistered={load} (to refresh seat count).
              */}
              <div data-slot="register-button" />
            </div>
          </div>
        )}
      </Async>
    </div>
  );
}
