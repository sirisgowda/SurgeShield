// Ported from prasanna_branch, restyled to main's dark palette.
const MODES = {
  NORMAL:   { label: 'Normal',           cls: 'bg-green-500/15 text-green-300 ring-green-500/30' },
  ELEVATED: { label: 'High demand',      cls: 'bg-amber-500/15 text-amber-300 ring-amber-500/30' },
  HIGH:     { label: 'Very high demand', cls: 'bg-red-500/15 text-red-300 ring-red-500/30' },
};

export default function ModeBadge({ mode = 'NORMAL' }) {
  const m = MODES[mode] ?? MODES.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      text-xs font-medium ring-1 ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />{m.label}
    </span>
  );
}
