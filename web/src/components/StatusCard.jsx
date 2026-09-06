import ModeBadge from './ModeBadge';

// D6 copy audit — use exactly these strings, never the "Never say" column.
// Colour rule: queued is blue/neutral, never green. Green means confirmed
// and nothing else.
const QUEUED_COPY = {
  NORMAL: "You're in the queue — confirming now…",
  HIGH: "Request received. Demand is very high — we'll confirm by email shortly.",
};

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-slate-400 shrink-0" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export default function StatusCard({ state }) {
  if (!state || state.phase === 'idle') return null;

  if (state.phase === 'submitting') {
    return (
      <div className="border rounded-lg p-4 flex items-center gap-3 bg-slate-50">
        <Spinner />
        <span className="text-sm text-slate-700">Sending your request…</span>
      </div>
    );
  }

  if (state.phase === 'queued') {
    const position = typeof state.position === 'number'
      ? state.position.toLocaleString()
      : state.position;
    const copy = state.mode === 'ELEVATED' ? (
      <>
        You're in the queue at position <strong>{position}</strong>. High demand right
        now — this usually takes a few seconds.
      </>
    ) : (QUEUED_COPY[state.mode] ?? QUEUED_COPY.NORMAL);

    return (
      <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
        <div className="flex items-center gap-3">
          <Spinner />
          <ModeBadge mode={state.mode} />
        </div>
        <p className="text-sm text-blue-900 mt-2">{copy}</p>
      </div>
    );
  }

  if (state.phase === 'done') {
    if (state.status === 'CONFIRMED') {
      return (
        <div className="border-2 border-green-500 rounded-lg p-4 bg-green-50">
          <p className="text-sm text-green-900">
            <strong>Confirmed.</strong> Your seat is reserved.
          </p>
        </div>
      );
    }
    if (state.status === 'WAITLISTED') {
      return (
        <div className="border rounded-lg p-4 bg-slate-50">
          <p className="text-sm text-slate-700">
            Sold out — you're on the waitlist. We'll email you if a seat opens.
          </p>
        </div>
      );
    }
    return (
      <div className="border rounded-lg p-4 bg-slate-50">
        <p className="text-sm text-slate-700">Registration is closed for this event.</p>
      </div>
    );
  }

  if (state.phase === 'error') {
    return (
      <div className="border rounded-lg p-4 bg-red-50 border-red-200">
        <p className="text-sm text-red-800">Something went wrong: {state.message}</p>
      </div>
    );
  }

  return null;
}
