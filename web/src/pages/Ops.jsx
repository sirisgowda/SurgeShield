import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { 
  Sparkles, 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  ShieldCheck, 
  ArrowLeft, 
  PlusCircle, 
  AlertCircle,
  Eye,
  Timer
} from 'lucide-react';

const initial = {
  title: '',
  description: '',
  starts_at: '',
  registration_opens_at: '',
  registration_closes_at: '',
  capacity: 50,
  event_mode: 'physical',
  venue: '',
  join_url: '',
};

function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function Ops() {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [problems, setProblems] = useState([]);
  const [err, setErr] = useState(null);
  const { isOrganizer } = useAuth();
  const nav = useNavigate();

  function set(k, v) { setForm((f) => ({ ...f, [k]: v })); }

  function quickSetDemoWindow() {
    const now = Date.now();
    setForm((f) => ({
      ...f,
      starts_at: new Date(now + 2 * 3600_000).toISOString(),
      registration_opens_at: new Date(now + 15_000).toISOString(),
      registration_closes_at: new Date(now + 3600_000).toISOString(),
    }));
  }

  function quickSetOpenNow() {
    const now = Date.now();
    setForm((f) => ({
      ...f,
      starts_at: new Date(now + 24 * 3600_000).toISOString(),
      registration_opens_at: new Date(now - 60_000).toISOString(),
      registration_closes_at: new Date(now + 12 * 3600_000).toISOString(),
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
      if (Array.isArray(e.problems)) setProblems(e.problems);
      else if (e.message === 'FORBIDDEN' || e.code === 'FORBIDDEN') {
        setErr('Only organizer accounts can publish events.');
      } else {
        setErr(e.message);
      }
    } finally {
      setBusy(false);
    }
  }

  const isVirtual = form.event_mode === 'virtual';

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 bg-[#120e0c]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2a2019] border border-[#3e2e26] text-orange-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-orange-400" />
            <span>Organizer Creator Studio</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Publish New <span className="text-orange-500">Event</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-400">
            Set capacity limits, configure registration burst windows, and deploy surge protection.
          </p>
        </div>

        <Link
          to="/events"
          className="inline-flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-orange-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Events Hub</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left: Event Form (7 cols) */}
        <div className="lg:col-span-7">
          <form onSubmit={submit} className="solid-panel p-6 sm:p-8 rounded-3xl space-y-5" noValidate>
            <h2 className="text-lg font-bold text-white flex items-center gap-2 border-b border-[#2e2622] pb-3">
              <PlusCircle className="w-5 h-5 text-orange-500" />
              <span>Event Details</span>
            </h2>

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                Event Title *
              </label>
              <input
                className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                placeholder="e.g., Global Tech Surge Summit 2026"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                Description (Optional)
              </label>
              <textarea
                className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                placeholder="Provide event details, schedule highlights, and access guidelines..."
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
                rows={3}
              />
            </div>

            {/* Event Start Time */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                Event Starts At *
              </label>
              <input
                className="solid-input w-full px-4 py-3 rounded-xl text-sm text-stone-200"
                type="datetime-local"
                value={toLocalInput(form.starts_at)}
                onChange={(e) => set('starts_at', e.target.value ? new Date(e.target.value).toISOString() : '')}
                required
              />
            </div>

            {/* Registration Window with Quick Presets */}
            <div className="p-4 rounded-2xl bg-[#15110f] border border-[#2e2622] space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5 text-amber-500" />
                  Registration Surge Window *
                </span>
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={quickSetDemoWindow}
                    className="px-2.5 py-1 rounded-md bg-[#2c1e18] hover:bg-[#38261e] text-orange-300 text-[11px] font-semibold border border-[#442c22] transition-colors cursor-pointer"
                  >
                    Opens in 15s (Demo)
                  </button>
                  <button
                    type="button"
                    onClick={quickSetOpenNow}
                    className="px-2.5 py-1 rounded-md bg-[#2c2417] hover:bg-[#382f1d] text-amber-300 text-[11px] font-semibold border border-[#44381e] transition-colors cursor-pointer"
                  >
                    Open Now
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400">Registration Opens At</label>
                  <input
                    className="solid-input w-full px-3 py-2.5 rounded-xl text-xs text-stone-200"
                    type="datetime-local"
                    value={toLocalInput(form.registration_opens_at)}
                    onChange={(e) => set('registration_opens_at', e.target.value ? new Date(e.target.value).toISOString() : '')}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400">Registration Closes At</label>
                  <input
                    className="solid-input w-full px-3 py-2.5 rounded-xl text-xs text-stone-200"
                    type="datetime-local"
                    value={toLocalInput(form.registration_closes_at)}
                    onChange={(e) => set('registration_closes_at', e.target.value ? new Date(e.target.value).toISOString() : '')}
                    required
                  />
                </div>
              </div>
            </div>

            {/* Capacity Limit */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-orange-500" />
                Max Seat Capacity *
              </label>
              <input
                className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                type="number"
                min={1}
                max={50000}
                placeholder="50"
                value={form.capacity}
                onChange={(e) => set('capacity', Number(e.target.value))}
                required
              />
            </div>

            {/* Event Mode Selection */}
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                Delivery Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div
                  onClick={() => set('event_mode', 'physical')}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-colors space-y-1 ${
                    form.event_mode === 'physical'
                      ? 'border-orange-500 bg-[#281c16]'
                      : 'border-[#2e2622] bg-[#161210] hover:border-[#3a2e28]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-xs text-white">In-Person Event</span>
                  </div>
                  <p className="text-[11px] text-stone-400">Physical venue with on-site entry</p>
                </div>

                <div
                  onClick={() => set('event_mode', 'virtual')}
                  className={`cursor-pointer p-3.5 rounded-xl border transition-colors space-y-1 ${
                    form.event_mode === 'virtual'
                      ? 'border-orange-500 bg-[#281c16]'
                      : 'border-[#2e2622] bg-[#161210] hover:border-[#3a2e28]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-orange-500" />
                    <span className="font-bold text-xs text-white">Virtual Stream</span>
                  </div>
                  <p className="text-[11px] text-stone-400">Encrypted online stream / meeting</p>
                </div>
              </div>
            </div>

            {/* Venue or Join URL */}
            {form.event_mode === 'physical' ? (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                  Venue Location *
                </label>
                <input
                  className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                  placeholder="e.g., Grand Convention Center, Hall 4B, Seattle, WA"
                  value={form.venue}
                  onChange={(e) => set('venue', e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                  Live Stream / Meeting URL *
                </label>
                <input
                  className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                  placeholder="e.g., https://meet.surgeshield.io/summit-2026"
                  value={form.join_url}
                  onChange={(e) => set('join_url', e.target.value)}
                  required
                />
              </div>
            )}

            {/* Validation & Errors */}
            {problems.length > 0 && (
              <div className="p-4 rounded-2xl bg-red-950/60 border border-red-800 space-y-1 text-xs text-red-300">
                <p className="font-bold">Please correct the following:</p>
                <ul className="list-disc pl-4 space-y-0.5">
                  {problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            )}

            {err && (
              <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 flex items-start gap-2.5 text-xs text-red-300" role="alert">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 px-6 rounded-2xl font-extrabold text-sm bg-[#ea580c] hover:bg-[#c2410c] text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                  <span>Publishing &amp; Provisioning Queues…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-white" />
                  <span>Publish Event to SurgeShield</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right: Live Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
            <Eye className="w-4 h-4 text-orange-500" />
            <span>Live Attendee Preview</span>
          </div>

          <div className="solid-panel p-6 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#221c19] text-stone-300 border border-[#332a25]">
                {isVirtual ? <Video className="w-3 h-3 text-orange-400" /> : <MapPin className="w-3 h-3 text-orange-400" />}
                <span>{isVirtual ? 'Virtual Stream' : 'In-Person'}</span>
              </span>

              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#281f19] border border-[#443329] text-amber-300">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>Live Preview</span>
              </span>
            </div>

            <div>
              <h3 className="font-bold text-lg text-white">
                {form.title || 'Untitled Event'}
              </h3>
              <p className="text-xs text-stone-400 mt-1 line-clamp-2">
                {form.description || 'Description will appear here as you type in the studio...'}
              </p>
            </div>

            <div className="space-y-1.5 py-3 border-y border-[#2e2622] text-xs text-stone-300">
              <div className="flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5 text-orange-500" />
                <span>{form.starts_at ? new Date(form.starts_at).toLocaleString() : 'Date & Time TBD'}</span>
              </div>
              <div className="flex items-center gap-2">
                {isVirtual ? <Video className="w-3.5 h-3.5 text-amber-500" /> : <MapPin className="w-3.5 h-3.5 text-orange-500" />}
                <span className="truncate">{isVirtual ? (form.join_url || 'Online Meeting Link') : (form.venue || 'Venue Address')}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-stone-400">Total Capacity</span>
                <span className="font-semibold text-white">{form.capacity || 0} seats</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-[#2c2420]">
                <div className="h-full rounded-full bg-orange-500 w-full" />
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#16110f] border border-[#2e2622] flex items-center gap-2.5 text-xs text-orange-300">
              <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0" />
              <span>SurgeShield FIFO Queue enabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
