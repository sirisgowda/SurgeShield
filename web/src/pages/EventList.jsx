import { useCallback, useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import Async from '../components/Async';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  Users, 
  Ticket, 
  Search, 
  PlusCircle, 
  ArrowRight, 
  ShieldCheck
} from 'lucide-react';

const BADGE_CONFIG = {
  SCHEDULED: {
    bg: 'bg-[#291f1a] border-[#3e2e26] text-orange-300',
    dot: 'bg-orange-400',
    label: 'Opens Soon'
  },
  REGISTRATION_OPEN: {
    bg: 'bg-[#2b2416] border-[#4a3b1d] text-amber-300',
    dot: 'bg-amber-400 animate-ping',
    label: 'Open for Booking'
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

export default function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('ALL'); // 'ALL' | 'OPEN' | 'PHYSICAL' | 'VIRTUAL'
  const { isOrganizer, isAttendee } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/events');
      setEvents(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Statistics
  const stats = useMemo(() => {
    const totalEvents = events.length;
    const openEvents = events.filter((e) => e.status === 'REGISTRATION_OPEN').length;
    const totalSeatsLeft = events.reduce((acc, e) => acc + (e.seats_left || 0), 0);
    return { totalEvents, openEvents, totalSeatsLeft };
  }, [events]);

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const matchesSearch = (e.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                            (e.venue || '').toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      if (filterMode === 'OPEN') return e.status === 'REGISTRATION_OPEN';
      if (filterMode === 'PHYSICAL') return e.event_mode !== 'virtual';
      if (filterMode === 'VIRTUAL') return e.event_mode === 'virtual';
      return true;
    });
  }, [events, searchQuery, filterMode]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8 bg-[#120e0c]">
      {/* Hero Banner with Stats - Solid */}
      <div className="rounded-3xl solid-panel p-6 sm:p-10 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2a201a] border border-[#3e2e26] text-orange-400 text-xs font-semibold">
              <ShieldCheck className="w-3.5 h-3.5 text-orange-500" />
              <span>SurgeShield Burst Engine Active</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
              Discover &amp; Book High-Demand <span className="text-orange-500">Events</span>
            </h1>
            <p className="text-sm sm:text-base text-stone-300">
              SurgeShield orchestrates registration queues with sub-millisecond FIFO ingestion to guarantee fair ticket access during massive demand surges.
            </p>
          </div>

          {/* Quick Organizer CTA or Attendee Counter */}
          <div className="flex flex-col sm:flex-row gap-3">
            {isOrganizer && (
              <Link
                to="/ops"
                className="px-5 py-3 rounded-2xl bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-sm flex items-center justify-center gap-2 transition-colors group cursor-pointer"
              >
                <PlusCircle className="w-4 h-4 text-white group-hover:rotate-90 transition-transform duration-200" />
                <span>Publish New Event</span>
              </Link>
            )}
            <Link
              to="/me"
              className="px-5 py-3 rounded-2xl bg-[#261f1b] hover:bg-[#302722] text-stone-200 hover:text-white font-semibold text-sm border border-[#382f29] flex items-center justify-center gap-2 transition-colors"
            >
              <Ticket className="w-4 h-4 text-orange-400" />
              <span>My Ticket Wallet</span>
            </Link>
          </div>
        </div>

        {/* Quick Platform Metrics Grid */}
        <div className="grid grid-cols-3 gap-3 sm:gap-6 pt-6 border-t border-[#2e2622]">
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-stone-400">Total Events</p>
            <p className="text-xl sm:text-2xl font-extrabold text-white mt-0.5">{stats.totalEvents}</p>
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-amber-400">Open For Booking</p>
            <p className="text-xl sm:text-2xl font-extrabold text-amber-300 mt-0.5">{stats.openEvents}</p>
          </div>
          <div>
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-orange-400">Seats Available</p>
            <p className="text-xl sm:text-2xl font-extrabold text-orange-300 mt-0.5">{stats.totalSeatsLeft}</p>
          </div>
        </div>
      </div>

      {/* Controls: Search & Category Filter Pills */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search events, venues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="solid-input w-full pl-10 pr-4 py-2.5 rounded-xl text-sm placeholder-stone-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-[#181412] rounded-xl border border-[#2e2622] overflow-x-auto w-full md:w-auto">
          {[
            { id: 'ALL', label: 'All Events' },
            { id: 'OPEN', label: 'Open Now' },
            { id: 'PHYSICAL', label: 'In-Person' },
            { id: 'VIRTUAL', label: 'Virtual' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterMode(tab.id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-[#ea580c] text-white'
                  : 'text-stone-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Event Cards Grid */}
      <Async
        loading={loading}
        error={error}
        onRetry={load}
        empty={events.length === 0 ? 'No events published yet. Organizers can create one now!' : null}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((evt) => {
            const badge = BADGE_CONFIG[evt.status] || BADGE_CONFIG.SCHEDULED;
            const isVirtual = evt.event_mode === 'virtual';
            const capacity = evt.capacity || 100;
            const seatsLeft = evt.seats_left ?? capacity;
            const percentRemaining = Math.round((seatsLeft / capacity) * 100);

            const dateStr = evt.starts_at ? new Date(evt.starts_at).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric'
            }) : 'Date TBD';
            const timeStr = evt.starts_at ? new Date(evt.starts_at).toLocaleTimeString(undefined, {
              hour: '2-digit', minute: '2-digit'
            }) : 'Time TBD';

            return (
              <div
                key={evt.id}
                className="group relative flex flex-col justify-between solid-panel-interactive rounded-2xl p-6"
              >
                <div className="space-y-4">
                  {/* Card Top: Mode & Status */}
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#221c19] text-stone-300 border border-[#332a25]">
                      {isVirtual ? <Video className="w-3 h-3 text-orange-400" /> : <MapPin className="w-3 h-3 text-orange-400" />}
                      <span>{isVirtual ? 'Virtual Stream' : 'In-Person'}</span>
                    </span>

                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${badge.bg}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-bold text-lg text-white group-hover:text-orange-400 transition-colors line-clamp-1">
                      {evt.title}
                    </h3>
                    <p className="text-xs text-stone-400 mt-1 line-clamp-2 min-h-[32px]">
                      {evt.description || (isVirtual ? 'Online interactive event session with live Q&A.' : (evt.venue ? `Location: ${evt.venue}` : 'Exclusive high-demand event experience.'))}
                    </p>
                  </div>

                  {/* Event Schedule Info */}
                  <div className="space-y-1.5 py-3 border-y border-[#2e2622] text-xs text-stone-300">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" />
                      <span>{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{timeStr}</span>
                    </div>
                  </div>

                  {/* Seat Availability Bar */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-stone-400 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-stone-400" />
                        Capacity
                      </span>
                      <span className="font-semibold text-white">
                        {seatsLeft} / {capacity} seats left
                      </span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-[#2c2420] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${seatsLeft <= 5 ? 'bg-rose-500' : 'bg-orange-500'}`}
                        style={{ width: `${Math.max(4, Math.min(100, percentRemaining))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Card Action Link */}
                <div className="pt-5 mt-4">
                  <Link
                    to={`/events/${evt.id}`}
                    className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-[#29221e] hover:bg-[#ea580c] text-white flex items-center justify-center gap-2 transition-colors border border-[#382f29]"
                  >
                    <span>{evt.status === 'REGISTRATION_OPEN' ? (isAttendee ? 'Book Ticket Now' : 'View Event Details') : 'View Event'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </Async>
    </div>
  );
}
