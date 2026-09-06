// Fake decision_log data (D2): "B's rows are in decision_log by 10:30. Until
// then, hardcode an array in the component — do not sit idle." This module
// is that hardcoded array, made stateful enough to feel like a live surge.
// D9 swaps this for the real /api/ops/timeline poll — nothing else changes.

const fmt = d => d.toLocaleTimeString('en-GB');

function modeForTick(tick) {
  if (tick < 5) return 'NORMAL';
  if (tick < 20) return 'ELEVATED';
  return 'HIGH';
}

export function genMockTimeline(state) {
  state.tick = (state.tick ?? 0) + 1;
  state.events ??= [];
  state.series ??= [];
  state.scale ??= [];
  state.instances ??= 2;
  state.lastMode ??= 'NORMAL';
  state.summary ??= { accepted: 0, confirmed: 0, duplicates: 0, overbookings: 0,
                       peak_instances: 2, rejected_5xx: 0 };

  const tick = state.tick;
  const now = new Date();
  const mode = modeForTick(tick);
  const rps = mode === 'NORMAL' ? 8 + Math.random() * 4
    : mode === 'ELEVATED' ? 60 + Math.random() * 20
    : 140 + Math.random() * 30;
  const inflight = Math.round(rps * (mode === 'HIGH' ? 3 : 1.2));

  if (mode !== state.lastMode) {
    state.events.unshift({
      ts: now.toISOString(), actor: 'controller', action: 'MODE_CHANGE',
      reason: 'rps_threshold', payload: { mode, inflight }, correlation_id: `mock-mode-${tick}`,
    });
    state.lastMode = mode;
  }

  const targetInstances = mode === 'NORMAL' ? 2 : mode === 'ELEVATED' ? 6 : 14;
  if (targetInstances !== state.instances) {
    state.events.unshift({
      ts: now.toISOString(), actor: 'autoscaler', action: 'SCALE',
      reason: 'queue_depth', payload: { from: state.instances, to: targetInstances },
      correlation_id: `mock-scale-${tick}`,
    });
    state.instances = targetInstances;
    state.summary.peak_instances = Math.max(state.summary.peak_instances, targetInstances);
  }

  if (tick % 7 === 0) {
    state.events.unshift({
      ts: now.toISOString(), actor: 'api', action: 'DUPLICATE_ABSORBED',
      reason: 'idempotency_key', payload: {}, correlation_id: `mock-dup-${tick}`,
    });
    state.summary.duplicates += 1;
  }

  if (mode === 'HIGH' && tick % 11 === 0) {
    state.events.unshift({
      ts: now.toISOString(), actor: 'api', action: 'SEAT_DENIED',
      reason: 'SOLD_OUT', payload: {}, correlation_id: `mock-deny-${tick}`,
    });
  }

  state.summary.accepted += Math.round(rps);
  state.summary.confirmed += Math.round(rps * 0.9);

  state.series.push({ t: fmt(now), rps: Math.round(rps), p95: Math.round(40 + rps * 1.5),
                       instances: state.instances });
  if (state.series.length > 60) state.series.shift();
  if (state.events.length > 200) state.events.length = 200;

  return { events: state.events, series: state.series, scale: state.scale };
}

export function genMockSummary(state) {
  return state.summary;
}

export function genMockInvariants() {
  // Invariants hold under the whole mock surge — that's the point of the
  // "Overbookings (0)" stat tile. Flip `ok` to false here to rehearse the
  // failure state of the panel.
  return {
    ok: true,
    checks: [
      { name: 'no_double_seat_allocation', ok: true },
      { name: 'queue_position_monotonic', ok: true },
      { name: 'idempotency_key_respected', ok: true },
    ],
  };
}

export function injectMockChaos(state, btn) {
  const now = new Date().toISOString();
  state.events ??= [];
  if (btn.target === 'all') {
    state.events.unshift({ ts: now, actor: 'system', action: 'BREAKER_CLOSED',
      reason: 'provider healthy', payload: { queued: 12 }, correlation_id: `mock-recover-${Date.now()}` });
    state.events.unshift({ ts: now, actor: 'operator', action: 'CHAOS_OFF',
      reason: 'all', payload: {}, correlation_id: `mock-chaosoff-${Date.now()}` });
  } else if (btn.target === 'email') {
    state.events.unshift({ ts: now, actor: 'system', action: 'BREAKER_OPEN',
      reason: '5 consecutive failures', payload: {}, correlation_id: `mock-break-${Date.now()}` });
    state.events.unshift({ ts: now, actor: 'operator', action: 'CHAOS_ON',
      reason: 'email', payload: {}, correlation_id: `mock-chaoson-${Date.now()}` });
  } else if (btn.target === 'latency') {
    state.events.unshift({ ts: now, actor: 'operator', action: 'CHAOS_ON',
      reason: 'latency', payload: {}, correlation_id: `mock-lat-${Date.now()}` });
  }
}
