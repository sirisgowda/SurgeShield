import { useRegistration } from '../hooks/useRegistration';
import StatusCard from '../components/StatusCard';

const EVENT_ID = import.meta.env.VITE_DEMO_EVENT_ID || 'demo-event';

export default function Register() {
  const { state, register } = useRegistration(EVENT_ID);
  const busy = state.phase === 'submitting' || state.phase === 'queued';

  return (
    <div className="max-w-md mx-auto p-6 space-y-4">
      <h1 className="text-lg font-semibold">Register for this event</h1>
      <button
        onClick={register}
        disabled={busy}
        className="w-full py-3 rounded-lg bg-blue-600 text-white font-semibold
                   hover:bg-blue-700 disabled:opacity-50"
      >
        Reserve your seat
      </button>
      <StatusCard state={state} />
    </div>
  );
}
