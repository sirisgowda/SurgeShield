import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import Async from '../components/Async';
import TicketModal from '../components/TicketModal';
import { 
  Ticket, 
  Calendar, 
  Clock, 
  MapPin, 
  Video, 
  CheckCircle2, 
  ArrowRight, 
  QrCode
} from 'lucide-react';

export default function MyRegistrations() {
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api('/api/events/me/registrations');
      setRegs(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8 bg-[#120e0c]">
      {/* Wallet Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2a2019] border border-[#3e2e26] text-orange-300 text-xs font-semibold">
            <Ticket className="w-3.5 h-3.5 text-orange-400" />
            <span>Digital Ticket Wallet</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Registered <span className="text-orange-500">Events</span>
          </h1>
          <p className="text-xs sm:text-sm text-stone-400">
            All your confirmed passes, access credentials, and live stream links.
          </p>
        </div>

        <Link
          to="/events"
          className="px-4 py-2.5 rounded-xl bg-[#201916] hover:bg-[#2c221e] text-stone-200 hover:text-white text-xs font-semibold border border-[#332620] flex items-center gap-2 transition-colors self-start sm:self-auto"
        >
          <span>Browse More Events</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Registrations List */}
      <Async
        loading={loading}
        error={error}
        onRetry={load}
        empty={
          regs.length === 0 ? (
            <div className="text-center py-12 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-[#241c18] border border-[#382b24] flex items-center justify-center">
                <Ticket className="w-8 h-8 text-orange-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-white">Your ticket wallet is empty</h3>
                <p className="text-sm text-stone-400 max-w-sm mx-auto">
                  You haven't reserved tickets for any events yet. Explore open drops and claim your seat.
                </p>
              </div>
              <Link
                to="/events"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#ea580c] hover:bg-[#c2410c] text-white font-bold text-xs transition-colors cursor-pointer"
              >
                <span>Explore Open Events</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : null
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {regs.map((r) => {
            const isVirtual = r.event_mode === 'virtual';
            const dateStr = r.starts_at ? new Date(r.starts_at).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            }) : 'Date TBD';
            const timeStr = r.starts_at ? new Date(r.starts_at).toLocaleTimeString(undefined, {
              hour: '2-digit', minute: '2-digit'
            }) : 'Time TBD';

            return (
              <div
                key={r.id}
                className="ticket-stub rounded-3xl p-6 flex flex-col justify-between space-y-5"
              >
                {/* Header */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold bg-[#221c19] text-stone-300 border border-[#332a25]">
                      {isVirtual ? <Video className="w-3 h-3 text-orange-400" /> : <MapPin className="w-3 h-3 text-orange-400" />}
                      <span>{isVirtual ? 'Virtual Stream' : 'In-Person Pass'}</span>
                    </span>

                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#281f19] border border-[#443329] text-amber-300">
                      <CheckCircle2 className="w-3 h-3 text-orange-400" />
                      <span>{r.status || 'CONFIRMED'}</span>
                    </span>
                  </div>

                  <h3 className="font-extrabold text-lg text-white line-clamp-1">
                    {r.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-stone-300 pt-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-orange-500" />
                      <span>{dateStr}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>{timeStr}</span>
                    </div>
                  </div>
                </div>

                {/* Virtual join URL if available */}
                {isVirtual && r.join_url && (
                  <div className="p-3 rounded-xl bg-[#201815] border border-[#382922] flex items-center justify-between">
                    <div className="truncate mr-2">
                      <p className="text-[11px] font-semibold text-orange-300">Live Join Link</p>
                      <p className="text-xs text-stone-400 truncate">{r.join_url}</p>
                    </div>
                    <a
                      href={r.join_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1 rounded-lg bg-[#ea580c] hover:bg-[#c2410c] text-white text-xs font-semibold transition-colors shrink-0"
                    >
                      Join
                    </a>
                  </div>
                )}

                {/* Action footer */}
                <div className="pt-2 border-t border-[#2e2622] flex items-center justify-between gap-3">
                  <div className="text-[11px] text-stone-500">
                    Pass Ref: <span className="font-mono text-orange-400 font-semibold">#{r.id}</span>
                  </div>

                  <button
                    onClick={() => setSelectedTicket(r)}
                    className="px-3.5 py-1.5 rounded-xl bg-[#261e1a] hover:bg-[#332822] text-white text-xs font-bold border border-[#382a23] flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5 text-orange-400" />
                    <span>View Pass</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Async>

      {/* Ticket Modal popup */}
      <TicketModal
        isOpen={!!selectedTicket}
        onClose={() => setSelectedTicket(null)}
        registration={selectedTicket}
      />
    </div>
  );
}
