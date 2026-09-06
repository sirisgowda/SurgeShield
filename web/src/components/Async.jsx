// Reusable loading / error / empty wrapper so every screen handles the
// same states the same way (Guideline 5: loading, empty, error, offline).
export default function Async({ loading, error, empty, onRetry, children }) {
  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-live="polite">
        <div className="animate-pulse h-24 bg-slate-100 rounded-lg" />
        <div className="animate-pulse h-24 bg-slate-100 rounded-lg" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg" role="alert">
        <p className="text-red-700 text-sm">{error}</p>
        {onRetry && (
          <button onClick={onRetry} className="underline text-sm mt-2 text-red-700">
            Try again
          </button>
        )}
      </div>
    );
  }
  if (empty) {
    return <p className="text-slate-500 text-sm py-6 text-center">{empty}</p>;
  }
  return children;
}
