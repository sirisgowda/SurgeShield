import { AlertTriangle, RefreshCw, Inbox } from 'lucide-react';

export default function Async({ loading, error, empty, onRetry, children }) {
  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-live="polite">
        <div className="animate-pulse h-28 solid-panel rounded-2xl bg-[#1c1714]" />
        <div className="animate-pulse h-28 solid-panel rounded-2xl bg-[#1c1714]" />
        <div className="animate-pulse h-28 solid-panel rounded-2xl bg-[#1c1714]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 solid-panel rounded-2xl border border-red-800 bg-[#251313] text-center space-y-3" role="alert">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[#3b1919] flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-red-200">Unable to load data</h3>
          <p className="text-sm text-red-300 mt-1 max-w-md mx-auto">{error}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#3b1919] hover:bg-[#4d2222] text-white transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="solid-panel rounded-2xl p-12 text-center space-y-3">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[#281e19] border border-[#3a2c25] flex items-center justify-center">
          <Inbox className="w-7 h-7 text-orange-400" />
        </div>
        <p className="text-stone-300 font-medium text-base">{empty}</p>
      </div>
    );
  }

  return children;
}
