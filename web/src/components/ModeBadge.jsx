const MODES = {
  NORMAL:   { label: 'Normal',           cls: 'bg-green-100 text-green-800' },
  ELEVATED: { label: 'High demand',      cls: 'bg-amber-100 text-amber-900' },
  HIGH:     { label: 'Very high demand', cls: 'bg-red-100 text-red-800' },
};

export default function ModeBadge({ mode = 'NORMAL' }) {
  const m = MODES[mode] ?? MODES.NORMAL;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                      text-xs font-medium ${m.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />{m.label}
    </span>
  );
}
