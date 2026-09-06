// This is the differentiator. Anyone can render a chart. Almost nobody turns
// machine events into English. Every action becomes a sentence a human reads
// without decoding JSON.
//
// Test: every action type in the seed/live decision_log data must render as
// a readable sentence. If any shows raw JSON, add it here.

export const NARRATE = {
  MODE_CHANGE: e => ({
    icon: '◐', tone: 'warn', short: e.payload.mode,
    text: `Switched to ${label(e.payload.mode)} — ${e.payload.inflight} requests in flight`,
  }),
  SCALE: e => ({
    icon: '▲', tone: e.payload.to > e.payload.from ? 'info' : 'good',
    short: `${e.payload.from}→${e.payload.to}`,
    text: e.payload.to > e.payload.from
      ? `Scaled out ${e.payload.from} → ${e.payload.to} instances (${e.reason})`
      : `Scaled in ${e.payload.from} → ${e.payload.to} instances — traffic stabilised`,
  }),
  BREAKER_OPEN: e => ({
    icon: '⚡', tone: 'bad', short: 'breaker',
    text: `Email provider failing — circuit opened after ${e.reason}. Confirmations queued.`,
  }),
  BREAKER_CLOSED: e => ({
    icon: '✓', tone: 'good', short: 'recovered',
    text: `Email provider recovered — ${e.payload.queued ?? 0} queued confirmations delivered`,
  }),
    SEAT_GRANTED: e => ({
    icon: '●', tone: 'good', short: null,
    text: `Seat confirmed — ${e.payload.seats_left} seat${e.payload.seats_left === 1 ? '' : 's'} remaining`,
  }),
  SEAT_DENIED: e => ({
    icon: '○', tone: 'muted', short: null,
    text: e.reason === 'SOLD_OUT'
      ? 'Sold out — subsequent requests waitlisted in arrival order'
      : `Rejected: ${e.reason}`,
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
    text: 'Duplicate submission absorbed by idempotency key — no second registration',
  }),
  CHAOS_ON: e => ({
    icon: '☠', tone: 'bad', short: 'chaos',
    text: `Chaos injected: ${e.reason} provider killed manually`,
  }),
  CHAOS_OFF: e => ({
    icon: '☀', tone: 'good', short: null,
    text: `Chaos cleared: ${e.reason} provider restored`,
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
}[m] ?? m);

export function narrate(e) {
  const fn = NARRATE[e.action];
  return fn ? fn(e) : { icon: '·', tone: 'muted', short: null, text: `${e.actor}: ${e.action}` };
}
