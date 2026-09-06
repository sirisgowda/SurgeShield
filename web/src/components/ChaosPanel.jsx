import { useState } from 'react';
import { api } from '../lib/api';

// Labelled in plain language because you'll press these on stage — make
// them big and unmissable.
const BUTTONS = [
  { target: 'email',   enabled: true,  label: 'Kill email provider' },
  { target: 'latency', enabled: true,  label: 'Inject 2s latency' },
  { target: 'all',     enabled: false, label: 'Restore all' },
];

export default function ChaosPanel({ mock = false, onChaosEvent }) {
  const [busy, setBusy] = useState(null);

  async function press(btn) {
    setBusy(btn.label);
    try {
      if (mock) {
        onChaosEvent?.(btn);
      } else {
        await api('/api/ops/chaos', {
          method: 'POST',
          body: JSON.stringify({ target: btn.target, enabled: btn.enabled }),
        });
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="border rounded-lg p-4">
      <div className="text-sm font-medium mb-3">Chaos controls</div>
      <div className="flex flex-wrap gap-3">
        {BUTTONS.map(btn => (
          <button
            key={btn.label}
            onClick={() => press(btn)}
            disabled={busy === btn.label}
            className={`px-4 py-3 rounded-lg text-sm font-semibold border-2 transition
              ${btn.target === 'all'
                ? 'border-green-600 text-green-700 hover:bg-green-50'
                : 'border-red-600 text-red-700 hover:bg-red-50'}
              disabled:opacity-50`}
          >
            {busy === btn.label ? 'Sending…' : btn.label}
          </button>
        ))}
      </div>
    </div>
  );
}
