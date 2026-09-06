import { useState, useRef, useCallback } from 'react';
import { api } from '../lib/api';

export function useRegistration(eventId) {
  const [state, setState] = useState({ phase: 'idle' });
  const key = useRef(crypto.randomUUID());   // stable across retries = idempotent

  const register = useCallback(async () => {
    setState({ phase: 'submitting' });
    try {
      const r = await api(`/api/events/${eventId}/register`, {
        method: 'POST', headers: { 'Idempotency-Key': key.current } });
      setState({ phase: 'queued', intentId: r.intent_id,
                 position: r.position, mode: r.mode });
      poll(r.intent_id, 0);
    } catch (e) { setState({ phase: 'error', message: e.message }); }
  }, [eventId]);

  function poll(intentId, n) {
    setTimeout(async () => {
      try {
        const s = await api(`/api/intents/${intentId}`);
        if (s.status === 'QUEUED') {
          setState(p => ({ ...p, position: s.position, mode: s.mode }));
          poll(intentId, n + 1);
        } else {
          setState({ phase: 'done', status: s.status, reason: s.reason });
        }
      } catch { poll(intentId, n + 1); }     // transient error: keep polling
    }, n < 10 ? 1000 : 3000);                // back off after 10 seconds
  }

  return { state, register };
}
