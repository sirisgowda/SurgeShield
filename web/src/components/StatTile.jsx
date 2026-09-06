export default function StatTile({ label, value, sub, tone = 'default' }) {
  const tones = { default: 'text-slate-900', good: 'text-green-700', bad: 'text-red-700' };
  return (
    <div className="border rounded-lg p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`text-2xl font-semibold tabular-nums ${tones[tone]}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}
