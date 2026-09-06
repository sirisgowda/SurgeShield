import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const initial = {
  title: '',
  description: '',
  starts_at: '',
  registration_opens_at: '',
  registration_closes_at: '',
  capacity: 20,
  event_mode: 'physical',
  venue: '',
  join_url: '',
};

export default function Ops() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState([]);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function quickSetDemoWindow() {
    setForm((f) => ({
      ...f,
      registration_opens_at: new Date(Date.now() + 30_000).toISOString(),
      registration_closes_at: new Date(Date.now() + 3600_000).toISOString(),
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setProblems([]);
    try {
      const event = await api('/api/events', { method: 'POST', body: form });
      nav(`/events/${event.id}`);
    } catch (e) {
      // Server sends { error: 'VALIDATION', problems: [...] } for field-level issues,
      // and a plain message for everything else.
      if (Array.isArray(e.problems)) setProblems(e.problems);
      else setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto mt-12 px-4 space-y-4">
      <h1 className="text-xl font-semibold">Create event</h1>

      <form onSubmit={submit} className="space-y-3" noValidate>
        <input
          className="w-full border rounded p-2"
          placeholder="Title"
          value={form.title}
          onChange={(e) => set('title', e.target.value)}
          required
        />
        <textarea
          className="w-full border rounded p-2"
          placeholder="Description (optional)"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
        />

        <label className="block text-sm text-slate-600">
          Starts at
          <input
            className="w-full border rounded p-2 mt-1"
            type="datetime-local"
            value={form.starts_at}
            onChange={(e) => set('starts_at', new Date(e.target.value).toISOString())}
            required
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm text-slate-600">
            Registration opens
            <input
              className="w-full border rounded p-2 mt-1"
              type="datetime-local"
              value={form.registration_opens_at ? toLocalInput(form.registration_opens_at) : ''}
              onChange={(e) => set('registration_opens_at', new Date(e.target.value).toISOString())}
              required
            />
          </label>
          <label className="block text-sm text-slate-600">
            Registration closes
            <input
              className="w-full border rounded p-2 mt-1"
              type="datetime-local"
              value={form.registration_closes_at ? toLocalInput(form.registration_closes_at) : ''}
              onChange={(e) => set('registration_closes_at', new Date(e.target.value).toISOString())}
              required
            />
          </label>
        </div>

        <button
          type="button"
          onClick={quickSetDemoWindow}
          className="text-xs underline text-slate-500"
        >
          Opens in 30s (demo)
        </button>

        <input
          className="w-full border rounded p-2"
          type="number"
          min={1}
          placeholder="Capacity"
          value={form.capacity}
          onChange={(e) => set('capacity', Number(e.target.value))}
          required
        />

        <div className="flex gap-4 text-sm text-slate-600">
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={form.event_mode === 'physical'}
              onChange={() => set('event_mode', 'physical')}
            />
            In person
          </label>
          <label className="flex items-center gap-1">
            <input
              type="radio"
              checked={form.event_mode === 'virtual'}
              onChange={() => set('event_mode', 'virtual')}
            />
            Virtual
          </label>
        </div>

        {form.event_mode === 'physical' ? (
          <input
            className="w-full border rounded p-2"
            placeholder="Venue"
            value={form.venue}
            onChange={(e) => set('venue', e.target.value)}
            required
          />
        ) : (
          <input
            className="w-full border rounded p-2"
            placeholder="Join URL"
            value={form.join_url}
            onChange={(e) => set('join_url', e.target.value)}
            required
          />
        )}

        {problems.length > 0 && (
          <ul className="text-red-600 text-sm list-disc pl-5" role="alert">
            {problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
        {err && <p className="text-red-600 text-sm" role="alert">{err}</p>}

        <button
          disabled={busy}
          className="w-full bg-black text-white rounded p-2 disabled:opacity-50"
        >
          {busy ? 'Creating…' : 'Create event'}
        </button>
      </form>
    </div>
  );
}

// datetime-local inputs need "YYYY-MM-DDTHH:mm" in local time, not an ISO string.
function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
