import { CheckCircle2, QrCode, Calendar, MapPin, Ticket, X, Zap, Share2 } from 'lucide-react';

export default function TicketModal({ isOpen, onClose, registration, event }) {
  if (!isOpen) return null;

  const title = registration?.title || event?.title || 'Event Pass';
  const startsAt = registration?.starts_at || event?.starts_at;
  const dateStr = startsAt ? new Date(startsAt).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
  }) : 'Date TBD';
  const timeStr = startsAt ? new Date(startsAt).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit'
  }) : 'Time TBD';

  const isVirtual = (registration?.event_mode || event?.event_mode) === 'virtual';
  const venue = registration?.venue || event?.venue || (isVirtual ? 'Virtual Stream' : 'Venue TBD');
  const joinUrl = registration?.join_url || event?.join_url;
  const status = registration?.status || 'CONFIRMED';
  const ticketRef = registration?.id || registration?.intent_id || 'SSH-' + Math.floor(100000 + Math.random() * 900000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-md bg-[#16100d] border border-orange-500/25 rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-orange-600 via-amber-600 to-rose-600 p-6 text-white text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-black/20 hover:bg-black/40 text-white/80 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="w-12 h-12 mx-auto rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center mb-3 shadow-inner">
            <CheckCircle2 className="w-7 h-7 text-white" />
          </div>

          <p className="text-xs uppercase tracking-widest font-bold text-orange-200">Official SurgePass</p>
          <h2 className="text-xl font-extrabold mt-1 text-white leading-snug">{title}</h2>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-950/60 border border-orange-400/40 text-orange-200 text-xs font-semibold mt-3">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>{status === 'CONFIRMED' ? 'Confirmed & Verified' : status}</span>
          </div>
        </div>

        {/* Ticket Details Body */}
        <div className="p-6 space-y-5 bg-[#16100d]/95 text-stone-200">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-stone-400">Date & Time</span>
              <p className="font-semibold text-white">{dateStr}</p>
              <p className="text-xs text-stone-400">{timeStr}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-semibold uppercase text-stone-400">Access Mode</span>
              <p className="font-semibold text-white">{isVirtual ? 'Virtual Pass' : 'In-Person Entry'}</p>
              <p className="text-xs text-stone-400 truncate">{venue}</p>
            </div>
          </div>

          {isVirtual && joinUrl && (
            <div className="p-3.5 rounded-xl bg-orange-950/40 border border-orange-500/30 flex items-center justify-between">
              <div className="truncate mr-2">
                <p className="text-xs font-semibold text-orange-300">Live Join Link</p>
                <p className="text-xs text-stone-400 truncate">{joinUrl}</p>
              </div>
              <a
                href={joinUrl}
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-semibold transition-colors shrink-0"
              >
                Join Event
              </a>
            </div>
          )}

          {/* Ticket Perforation Line */}
          <div className="relative flex items-center my-2">
            <div className="absolute -left-6 w-4 h-8 bg-[#0c0908] rounded-r-full border-r border-orange-500/20" />
            <div className="w-full border-t-2 border-dashed border-orange-500/20" />
            <div className="absolute -right-6 w-4 h-8 bg-[#0c0908] rounded-l-full border-l border-orange-500/20" />
          </div>

          {/* QR Stub & Reference */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <div className="space-y-1 text-xs">
              <p className="text-[11px] font-semibold uppercase text-stone-400">Ticket Reference</p>
              <p className="font-mono text-xs font-bold text-orange-300 tracking-wider">#{ticketRef}</p>
              <p className="text-[11px] text-stone-500">Secured via SurgeShield Ingestion</p>
            </div>

            <div className="w-20 h-20 p-1.5 rounded-xl bg-white flex items-center justify-center shrink-0 shadow-lg">
              <QrCode className="w-full h-full text-stone-900" />
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-white/10 hover:bg-orange-500/20 text-white font-semibold text-sm transition-colors border border-white/10 hover:border-orange-500/30 cursor-pointer"
          >
            Close Pass
          </button>
        </div>
      </div>
    </div>
  );
}
