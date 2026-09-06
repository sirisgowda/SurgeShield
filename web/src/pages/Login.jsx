import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../lib/api';
import GoogleButton from '../components/GoogleButton';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', role: 'attendee' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const { token } = await api(`/api/auth/${mode}`, { method: 'POST', body: form });
      setToken(token);
      nav('/events');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false); // always, so a failed request never leaves the button stuck
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-24 space-y-4 px-4">
      <div>
        <h1 className="text-2xl font-semibold">SurgeShield</h1>
        <p className="text-sm text-slate-500">
          {mode === 'login' ? 'Log in to manage or join events.' : 'Create an account to get started.'}
        </p>
      </div>

      <form onSubmit={submit} className="space-y-3" noValidate>
        <input
          className="w-full border rounded p-2"
          type="email"
          required
          autoComplete="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          placeholder="you@example.com"
        />
        <input
          className="w-full border rounded p-2"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          placeholder="Password (8+ characters)"
        />

        {mode === 'signup' && (
          <div className="flex gap-4 text-sm text-slate-600">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="role"
                checked={form.role === 'attendee'}
                onChange={() => setForm({ ...form, role: 'attendee' })}
              />
              Attendee
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="role"
                checked={form.role === 'organizer'}
                onChange={() => setForm({ ...form, role: 'organizer' })}
              />
              Organizer
            </label>
          </div>
        )}

        {err && (
          <p className="text-red-600 text-sm" role="alert">
            {err}
          </p>
        )}

        <button
          disabled={busy}
          className="w-full bg-black text-white rounded p-2 disabled:opacity-50"
        >
          {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <div className="flex items-center gap-3 text-xs text-slate-400">
        <div className="h-px bg-slate-200 flex-1" />
        or
        <div className="h-px bg-slate-200 flex-1" />
      </div>

      <GoogleButton onSuccess={() => nav('/events')} onError={setErr} />

      <button
        type="button"
        className="text-sm underline text-slate-600"
        onClick={() => {
          setErr(null);
          setMode(mode === 'login' ? 'signup' : 'login');
        }}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Already have one? Log in'}
      </button>
    </div>
  );
}
