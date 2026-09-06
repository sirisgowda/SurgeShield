import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import GoogleButton from '../components/GoogleButton';
import { 
  Zap, 
  Ticket, 
  Sparkles, 
  Lock, 
  Mail, 
  ArrowRight, 
  Check, 
  AlertCircle
} from 'lucide-react';

export default function Login() {
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [form, setForm] = useState({ email: '', password: '', role: 'attendee' });
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(null);
  const [err, setErr] = useState(null);
  const { login, signup, demoLogin, handleAuthSuccess } = useAuth();
  const nav = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (mode === 'login') {
        const res = await login(form.email, form.password);
        nav(res.user.role === 'organizer' ? '/ops' : '/events');
      } else {
        const res = await signup(form.email, form.password, form.role);
        nav(res.user.role === 'organizer' ? '/ops' : '/events');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDemo(roleToUse) {
    setDemoBusy(roleToUse);
    setErr(null);
    try {
      const res = await demoLogin(roleToUse);
      nav(roleToUse === 'organizer' ? '/ops' : '/events');
    } catch (e) {
      setErr(e.message);
    } finally {
      setDemoBusy(null);
    }
  }

  return (
    <div className="min-h-[90vh] flex flex-col justify-center items-center px-4 py-12 bg-[#120e0c]">
      <div className="w-full max-w-md space-y-6">
        {/* Header Branding */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#ea580c] mb-2">
            <Zap className="w-7 h-7 text-white fill-white" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            Surge<span className="text-orange-500">Shield</span>
          </h1>
          <p className="text-sm text-stone-400 max-w-sm mx-auto">
            High-concurrency event registration and burst-protected ticketing.
          </p>
        </div>

        {/* Main Card */}
        <div className="solid-panel p-6 sm:p-8 rounded-3xl space-y-6">
          {/* Mode Tabs */}
          <div className="grid grid-cols-2 p-1 bg-[#15110f] rounded-xl border border-[#2e2622]">
            <button
              type="button"
              onClick={() => { setMode('login'); setErr(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-[#ea580c] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setErr(null); }}
              className={`py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                mode === 'signup'
                  ? 'bg-[#ea580c] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-orange-500" />
                Email Address
              </label>
              <input
                className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                type="email"
                required
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@company.com"
              />
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-orange-500" />
                Password
              </label>
              <input
                className="solid-input w-full px-4 py-3 rounded-xl text-sm placeholder-stone-500"
                type="password"
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Minimum 8 characters"
              />
            </div>

            {/* Role selection for signup */}
            {mode === 'signup' && (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-300">
                  Select Your Platform Role
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {/* Attendee Option */}
                  <div
                    onClick={() => setForm({ ...form, role: 'attendee' })}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-colors text-left space-y-1 ${
                      form.role === 'attendee'
                        ? 'border-orange-500 bg-[#2b2019]'
                        : 'border-[#2e2622] bg-[#161210] hover:border-[#3e342f]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-[#2e2622] flex items-center justify-center">
                        <Ticket className="w-4 h-4 text-orange-400" />
                      </div>
                      {form.role === 'attendee' && <Check className="w-4 h-4 text-orange-500" />}
                    </div>
                    <p className="font-bold text-xs text-white">Attendee</p>
                    <p className="text-[11px] text-stone-400 leading-tight">Book tickets & join events</p>
                  </div>

                  {/* Organizer Option */}
                  <div
                    onClick={() => setForm({ ...form, role: 'organizer' })}
                    className={`cursor-pointer p-3.5 rounded-xl border transition-colors text-left space-y-1 ${
                      form.role === 'organizer'
                        ? 'border-orange-500 bg-[#2b2019]'
                        : 'border-[#2e2622] bg-[#161210] hover:border-[#3e342f]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-7 h-7 rounded-lg bg-[#2e2622] flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                      </div>
                      {form.role === 'organizer' && <Check className="w-4 h-4 text-orange-500" />}
                    </div>
                    <p className="font-bold text-xs text-white">Organizer</p>
                    <p className="text-[11px] text-stone-400 leading-tight">Post events & manage capacity</p>
                  </div>
                </div>
              </div>
            )}

            {/* Error Message */}
            {err && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2.5" role="alert">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span>{err}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#ea580c] hover:bg-[#c2410c] text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group cursor-pointer"
            >
              <span>{busy ? 'Authenticating…' : mode === 'login' ? 'Sign In to SurgeShield' : 'Create Account'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-[#2e2622]" />
            <span className="absolute bg-[#1c1714] px-3 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Quick Test Personas
            </span>
          </div>

          {/* Quick 1-Click Demo Logins */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              disabled={!!demoBusy}
              onClick={() => handleDemo('attendee')}
              className="py-2.5 px-3 rounded-xl bg-[#2a211c] hover:bg-[#342923] border border-[#3e322b] text-orange-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Ticket className="w-3.5 h-3.5 text-orange-400" />
              <span>{demoBusy === 'attendee' ? 'Logging in…' : 'Demo Attendee'}</span>
            </button>

            <button
              type="button"
              disabled={!!demoBusy}
              onClick={() => handleDemo('organizer')}
              className="py-2.5 px-3 rounded-xl bg-[#2a211c] hover:bg-[#342923] border border-[#3e322b] text-orange-300 text-xs font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>{demoBusy === 'organizer' ? 'Logging in…' : 'Demo Organizer'}</span>
            </button>
          </div>

          {/* Google Sign In Component wrapper */}
          <div className="flex justify-center pt-1">
            <GoogleButton 
              onSuccess={(user) => {
                handleAuthSuccess(localStorage.getItem('token'), user);
                nav(user.role === 'organizer' ? '/ops' : '/events');
              }} 
              onError={setErr} 
            />
          </div>
        </div>

        {/* Footer info */}
        <p className="text-center text-xs text-stone-500">
          SurgeShield Engine v2.4 • Active Burst Protection &amp; FIFO Queue
        </p>
      </div>
    </div>
  );
}
