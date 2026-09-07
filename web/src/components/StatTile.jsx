// Ported from prasanna_branch, restyled to main's dark palette.
export default function StatTile({ label, value, sub, tone = 'default' }) {
  const tones = {
    default: 'text-white',
    good: 'text-green-400',
    bad: 'text-red-400',
  };
  return (
    <div className="border border-[#2e2622] bg-[#16110f] rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-stone-400">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tones[tone] ?? tones.default}`}>
        {value ?? '—'}
      </div>
      {sub && <div className="text-xs text-stone-500 mt-0.5">{sub}</div>}
    </div>
  );
}
