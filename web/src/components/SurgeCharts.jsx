// Ported from prasanna_branch, restyled dark, and corrected to the real API shape.
//
// The original charted three series: rps, p95 and instances. `/api/ops/timeline`
// returns series rows of { t, rps, inflight } and a separate `scale` array of
// { t, instances } — it has never returned p95, so that chart would always have
// rendered empty. Replaced with in-flight requests (which the API does return)
// and instances is fed from `scale`, where it actually lives.
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, ReferenceLine,
} from 'recharts';

// One shared, colourblind-safe palette. Use it everywhere; never pick ad-hoc colours.
export const C = { rps: '#60a5fa', inflight: '#fbbf24', inst: '#2dd4bf', grid: '#2e2622' };

const fmtTime = t => {
  const d = new Date(t);
  return isNaN(d) ? '' : d.toLocaleTimeString('en-GB', { minute: '2-digit', second: '2-digit' });
};

function Chart({ label, data, dataKey, color, markers }) {
  return (
    <div className="border border-[#2e2622] bg-[#16110f] rounded-lg p-4">
      <div className="text-sm font-medium mb-2 text-stone-300">{label}</div>
      {!data?.length ? (
        <div className="h-[140px] flex items-center justify-center text-xs text-stone-500">
          no data in this window
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={data} margin={{ left: -20, right: 8, top: 4 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="t" tickFormatter={fmtTime} tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#a8a29e' }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              labelFormatter={fmtTime}
              contentStyle={{ background: '#120e0c', border: '1px solid #2e2622', borderRadius: 8, fontSize: 12 }}
              itemStyle={{ color: '#e7e5e4' }}
            />
            {markers.map((m, i) => (
              <ReferenceLine key={i} x={m.t} stroke="#78716c" strokeDasharray="3 3"
                label={{ value: m.short, fontSize: 10, position: 'top', fill: '#a8a29e' }} />
            ))}
            <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2}
                  dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default function SurgeCharts({ series = [], scale = [], markers = [] }) {
  return (
    <div className="space-y-4">
      <Chart label="Requests / sec"     data={series} dataKey="rps"       color={C.rps}      markers={markers} />
      <Chart label="Requests in flight" data={series} dataKey="inflight"  color={C.inflight} markers={markers} />
      <Chart label="Active instances"   data={scale}  dataKey="instances" color={C.inst}     markers={markers} />
    </div>
  );
}
