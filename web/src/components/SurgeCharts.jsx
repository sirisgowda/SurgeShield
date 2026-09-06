import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

// One shared, colourblind-safe palette. Use it everywhere; never pick ad-hoc colours.
export const C = { rps: '#2563eb', p95: '#d97706', inst: '#0f766e', grid: '#e2e8f0' };

const ROWS = [
  { key: 'rps',       label: 'Requests / sec',   color: C.rps },
  { key: 'p95',       label: 'p95 latency (ms)', color: C.p95 },
  { key: 'instances', label: 'Active instances', color: C.inst },
];

export default function SurgeCharts({ series, markers = [] }) {
  return (
    <div className="space-y-4">
      {ROWS.map(({ key, label, color }) => (
        <div key={key} className="border rounded-lg p-4">
          <div className="text-sm font-medium mb-2">{label}</div>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={series} margin={{ left: -20, right: 8, top: 4 }}>
              <CartesianGrid stroke={C.grid} vertical={false} />
              <XAxis dataKey="t" tick={{ fontSize: 11 }} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <Tooltip />
              {/* mode changes and breaker trips annotated straight onto the chart */}
              {markers.map((m, i) => (
                <ReferenceLine
                  key={i}
                  x={m.t}
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  label={{ value: m.short, fontSize: 10, position: 'top' }}
                />
              ))}
              <Line
                type="monotone"
                dataKey={key}
                stroke={color}
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </div>
  );
}
