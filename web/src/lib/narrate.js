// Turns decision_log rows into English. Anyone can render a chart; the point of
// this file is that a judge reads a sentence instead of decoding JSON.
//
// Ported from prasanna_branch. One change: every formatter is called through a
// try/catch in narrate() below, and payload access is optional-chained. The
// originals assumed payload shapes (e.payload.mode, e.payload.to) that are not
// present on every row in the live decision_log — a single missing key would
// throw inside render and blank the whole dashboard. On stage that is fatal.

export const NARRATE = {
  MODE_CHANGE: e => ({
    icon: '◐', tone: 'warn', short: e.payload?.mode ?? 'mode',
    text: `Switched to ${label(e.payload?.mode)} — ${e.payload?.inflight ?? 0} requests in flight`,
  }),
  SCALE: e => ({
    icon: '▲', tone: (e.payload?.to ?? 0) > (e.payload?.from ?? 0) ? 'info' : 'good',
    short: `${e.payload?.from ?? '?'}→${e.payload?.to ?? '?'}`,
    text: (e.payload?.to ?? 0) > (e.payload?.from ?? 0)
      ? `Scaled out ${e.payload?.from} → ${e.payload?.to} instances (${e.reason ?? 'load'})`
      : `Scaled in ${e.payload?.from} → ${e.payload?.to} instances — traffic stabilised`,
  }),
  BREAKER_OPEN: e => ({
    icon: '⚡', tone: 'bad', short: 'breaker',
    text: `Email provider failing — circuit opened after ${e.reason ?? 'repeated failures'}. Confirmations queued.`,
  }),
  BREAKER_CLOSED: e => ({
    icon: '✓', tone: 'good', short: 'recovered',
    text: `Email provider recovered — circuit closed${e.payload?.queued ? `, ${e.payload.queued} queued confirmations delivered` : ''}`,
  }),
  SEAT_GRANTED: e => ({
    icon: '●', tone: 'good', short: null,
    text: e.payload?.seats_left == null
      ? 'Seat confirmed'
      : `Seat confirmed — ${e.payload.seats_left} seat${e.payload.seats_left === 1 ? '' : 's'} remaining`,
  }),
  SEAT_DENIED: e => ({
    icon: '○', tone: 'muted', short: null,
    text: e.reason === 'SOLD_OUT'
      ? 'Sold out — subsequent requests waitlisted in arrival order'
      : `Rejected: ${e.reason ?? 'unknown reason'}`,
  }),
  INTENT_ACCEPTED: () => ({
    icon: '→', tone: 'info', short: null,
    text: 'Registration accepted and queued',
  }),
  NOTIFY_SENT: () => ({
    icon: '✉', tone: 'good', short: null,
    text: 'Confirmation email sent',
  }),
  NOTIFY_FAILED: e => ({
    icon: '✉', tone: 'bad', short: 'notify-fail',
    text: `Confirmation email failed to send${e.reason ? ` — ${e.reason}` : ''}`,
  }),
  DUPLICATE_ABSORBED: () => ({
    icon: '⧉', tone: 'muted', short: null,
    text: 'Duplicate submission absorbed — no second registration',
  }),
  CHAOS_ON: e => ({
    icon: '☠', tone: 'bad', short: 'chaos',
    text: `Chaos injected: ${e.reason ?? 'provider'} killed manually`,
  }),
  CHAOS_OFF: e => ({
    icon: '☀', tone: 'good', short: null,
    text: `Chaos cleared: ${e.reason ?? 'provider'} restored`,
  }),
  DLQ: () => ({
    icon: '!', tone: 'bad', short: 'DLQ',
    text: 'Message dead-lettered after 3 attempts',
  }),
};

const label = m => ({
  NORMAL: 'instant booking',
  ELEVATED: 'controlled admission',
  HIGH: 'queued confirmation',
}[m] ?? m ?? 'normal');

const FALLBACK = e => ({
  icon: '·', tone: 'muted', short: null,
  text: `${e?.actor ?? 'system'}: ${e?.action ?? 'event'}`,
});

export function narrate(e) {
  try {
    const fn = NARRATE[e?.action];
    return fn ? fn(e) : FALLBACK(e);
  } catch {
    return FALLBACK(e);   // never let one malformed row blank the dashboard
  }
}
