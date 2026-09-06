import { useCallback, useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import Async from '../components/Async';
import TicketModal from '../components/TicketModal';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  Ticket, 
  ShieldCheck, 
  ArrowLeft, 
  CheckCircle2, 
  AlertCircle,
  Sparkles,
  Hourglass
} from 'lucide-react';

const BADGE_CONFIG = {
  SCHEDULED: {
    bg: 'bg-[#291f1a] border-[#3e2e26] text-orange-300',
    dot: 'bg-orange-400',
    label: 'Registration Opens Soon'
  },
  REGISTRATION_OPEN: {
    bg: 'bg-[#2b2416] border-[#4a3b1d] text-amber-300',
    dot: 'bg-amber-400 animate-ping',
    label: 'Registration Open Now'
  },
  SOLD_OUT: {
    bg: 'bg-[#2d1b1a] border-[#4a2624] text-rose-300',
    dot: 'bg-rose-400',
    label: 'Sold Out'
  },
  CLOSED: {
    bg: 'bg-[#201c1a] border-[#332c28] text-stone-400',
    dot: 'bg-stone-500',
    label: 'Registration Closed'
  },
};

function useCountdown(target) {
  const [msLeft, setMsLeft] = useState(() => new Date(target) - new Date());
  useEffect(() => {
    if (!target) return;
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
  const { user, isOrganizer, isAttendee } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Registration engine state
  const [registering, setRegistering] = useState(false);
  const [registerStep, setRegisterStep] = useState('IDLE');
  const [registrationResult, setRegistrationResult] = useState(null);
  const [registerError, setRegisterError] = useState(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const nav = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api(`/api/events/${id}`);
      setEvent(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const msLeft = useCountdown(event?.registration_opens_at ?? Date.now());
  const countdown = event?.status === 'SCHEDULED' ? formatCountdown(msLeft) : null;

  // Handle Ticket Registration
  const handleRegister = async () => {
    if (!isAttendee) {
      setRegisterError('Only Attendee accounts can register for tickets.');
      return;
    }

    setRegistering(true);
    setRegisterStep('INGESTING');
    setRegisterError(null);

    const idempotencyKey = 'web-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);

    try {
      const res = await api(`/api/events/${id}/register`, {
        method: 'POST',
        headers: { 'idempotency-key': idempotencyKey }
      });

      setRegistrationResult(res);
      setRegisterStep('CONFIRMED');
      setShowTicketModal(true);
      load();
    } catch (e) {
      setRegisterError(e.message || 'Registration failed. Please try again.');
      setRegisterStep('IDLE');
    } finally {
      setRegistering(false);
    }
  };

  const badge = event ? (BADGE_CONFIG[event.status] || BADGE_CONFIG.SCHEDULED) : BADGE_CONFIG.SCHEDULED;
  const isVirtual = event?.event_mode === 'virtual';
  const capacity = event?.capacity || 100;
  const seatsLeft = event?.seats_left ?? capacity;
  const percentRemaining = Math.round((seatsLeft / capacity) * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6 bg-[#120e0c]">
      {/* Back button */}
      <Link
        to="/events"
        className="inline-flex items-center gap-2 text-xs font-semibold text-stone-400 hover:text-orange-400 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Events Hub</span>
      </Link>

      <Async loading={loading} error={error} onRetry={load}>
        {event && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main Event Overview (2 cols) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Event Header Card */}
              <div className="solid-panel p-6 sm:p-8 rounded-3xl space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold bg-[#221c19] text-stone-300 border border-[#332a25]">
                    {isVirtual ? <Video className="w-3.5 h-3.5 text-orange-400" /> : <MapPin className="w-3.5 h-3.5 text-orange-400" />}
                    <span>{isVirtual ? 'Virtual Stream Pass' : 'In-Person Event'}</span>
                  </span>

                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                    <span className={`w-2 h-2 rounded-full ${badge.dot}`} />
                    <span>{badge.label}</span>
                  </span>
                </div>

                <div className="space-y-2">
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
                    {event.title}
                  </h1>
                  <p className="text-sm text-stone-300 leading-relaxed">
                    {event.description || 'Join this exclusive event experience secured by SurgeShield.'}
                  </p>
                </div>

                {/* Date & Location Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-3.5 rounded-2xl bg-[#15110f] border border-[#2e2622] space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" />
                      Starts At
                    </span>
                    <p className="font-semibold text-sm text-white">
                      {event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, {
                        weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                      }) : 'Date TBD'}
                    </p>
                    <p className="text-xs text-stone-400">
                      {event.starts_at ? new Date(event.starts_at).toLocaleTimeString(undefined, {
                        hour: '2-digit', minute: '2-digit'
                      }) : 'Time TBD'}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-[#15110f] border border-[#2e2622] space-y-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-stone-400 flex items-center gap-1.5">
                      {isVirtual ? <Video className="w-3.5 h-3.5 text-amber-500" /> : <MapPin className="w-3.5 h-3.5 text-orange-500" />}
                      {isVirtual ? 'Virtual Platform' : 'Venue Location'}
                    </span>
                    <p className="font-semibold text-sm text-white truncate">
                      {isVirtual ? 'Encrypted Stream Link' : (event.venue || 'Venue Address Provided Upon Booking')}
                    </p>
                    <p className="text-xs text-stone-400">
                      {isVirtual ? 'Link available after ticket booking' : 'Check-in on site'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Surge Protection Notice */}
              <div className="solid-panel p-5 rounded-2xl border border-[#3e2e26] bg-[#18120f] flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-[#2e221b] border border-[#443329] flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5 text-orange-400" />
                </div>
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-orange-300">SurgeShield Fairness Guarantee</p>
                  <p className="text-stone-300 leading-relaxed">
                    Registrations are sequenced via distributed FIFO queues to prevent race conditions and guarantee fair seat allocation.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Sidebar: Registration Terminal (1 col) */}
            <div className="space-y-6">
              <div className="solid-panel p-6 rounded-3xl space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-white flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-orange-500" />
                    <span>Ticket Terminal</span>
                  </h3>
                  <span className="text-xs font-semibold text-orange-300 bg-[#281c16] px-2.5 py-0.5 rounded-full border border-[#442c22]">
                    FREE PASS
                  </span>
                </div>

                {/* Capacity Counter */}
                <div className="p-4 rounded-2xl bg-[#15110f] border border-[#2e2622] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-stone-400">Remaining Seats</span>
                    <span className="font-bold text-white text-sm">{seatsLeft} / {capacity}</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-stone-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${seatsLeft <= 5 ? 'bg-rose-500' : 'bg-orange-500'}`}
                      style={{ width: `${Math.max(4, Math.min(100, percentRemaining))}%` }}
                    />
                  </div>
                </div>

                {/* Countdown if Scheduled */}
                {countdown && (
                  <div className="p-4 rounded-2xl bg-[#1f1612] border border-[#3e2a20] text-center space-y-1">
                    <div className="flex items-center justify-center gap-1.5 text-xs text-orange-300 font-semibold">
                      <Hourglass className="w-3.5 h-3.5 animate-spin" />
                      <span>Registration Opens In</span>
                    </div>
                    <p className="text-2xl font-mono font-extrabold text-white tracking-widest">{countdown}</p>
                  </div>
                )}

                {/* Error Banner */}
                {registerError && (
                  <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-800 text-xs text-red-300 flex items-start gap-2.5" role="alert">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{registerError}</span>
                  </div>
                )}

                {/* Registration Action Based on RBAC & Event State */}
                <div className="space-y-3 pt-2">
                  {isOrganizer ? (
                    <div className="p-4 rounded-2xl bg-[#201713] border border-[#38261e] text-center space-y-2">
                      <div className="w-8 h-8 mx-auto rounded-xl bg-[#2e2019] flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-orange-400" />
                      </div>
                      <p className="font-bold text-xs text-orange-200">Organizer Preview Mode</p>
                      <p className="text-[11px] text-stone-400">
                        You are viewing this event as an Organizer. Switch to an Attendee persona to test ticket booking.
                      </p>
                    </div>
                  ) : event.status === 'REGISTRATION_OPEN' ? (
                    <button
                      onClick={handleRegister}
                      disabled={registering || seatsLeft <= 0}
                      className="w-full py-3.5 px-4 rounded-xl font-extrabold text-sm bg-[#ea580c] hover:bg-[#c2410c] text-white flex items-center justify-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                    >
                      {registering ? (
                        <>
                          <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
                          <span>Queueing Request…</span>
                        </>
                      ) : (
                        <>
                          <Ticket className="w-4 h-4" />
                          <span>Register &amp; Claim Ticket</span>
                        </>
                      )}
                    </button>
                  ) : event.status === 'SOLD_OUT' ? (
                    <button
                      disabled
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#2e1919] border border-[#4a2222] text-rose-300 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <span>Event Sold Out</span>
                    </button>
                  ) : event.status === 'SCHEDULED' ? (
                    <button
                      disabled
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-[#281e18] border border-[#3a2a22] text-orange-300 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <span>Registration Not Started</span>
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-stone-800 text-stone-400 border border-stone-700 flex items-center justify-center gap-2 cursor-not-allowed"
                    >
                      <span>Registration Closed</span>
                    </button>
                  )}

                  {/* If user has a booked ticket */}
                  {registrationResult && (
                    <button
                      onClick={() => setShowTicketModal(true)}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#261e19] hover:bg-[#332720] border border-[#443329] text-orange-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4 text-orange-400" />
                      <span>View Confirmed SurgePass</span>
                    </button>
                  )}
                </div>

                <div className="text-[11px] text-stone-500 text-center space-y-1 pt-2">
                  <p>1 ticket per account • Instant confirmation</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Async>

      {/* Ticket Modal popup */}
      <TicketModal
        isOpen={showTicketModal}
        onClose={() => setShowTicketModal(false)}
        registration={registrationResult}
        event={event}
      />
    </div>
  );
}
