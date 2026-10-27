import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertIcon, SparklesIcon } from './icons.jsx';
import { formatDateTime, formatNumber } from '../utils/format.js';

const ChartTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;

  const point = payload[0].payload;

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur">
      <p className="text-slate-400">{formatDateTime(point.timestamp)}</p>
      <p className="mt-1 font-semibold text-red-400">
        {formatNumber(point.count)} {point.count === 1 ? 'error' : 'errors'}
      </p>
    </div>
  );
};

export const ErrorChart = ({ series, totalErrors, loading, onAnalyze }) => (
  <section className="rounded-2xl border border-slate-800/80 bg-slate-900/50">
    <div className="flex flex-col gap-2 border-b border-slate-800/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-sm font-semibold text-white">Errors vs time</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          ERROR volume for the selected time, service, and search filters
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-red-500/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400">
          <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
          {formatNumber(totalErrors)} errors
        </span>
        <button
          type="button"
          onClick={onAnalyze}
          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-gradient-to-r from-violet-500/15 to-sky-500/15 px-3 py-1.5 text-[11px] font-semibold text-violet-200 transition hover:from-violet-500/25 hover:to-sky-500/25"
        >
          <SparklesIcon className="h-3.5 w-3.5" />
          Analyze with AI
        </button>
      </div>
    </div>

    <div className="h-64 px-2 py-4 sm:px-4">
      {loading ? (
        <div className="flex h-full items-end gap-2 px-4 pb-6">
          {[38, 62, 25, 74, 44, 58, 32, 70, 48, 22, 64, 40].map((height, index) => (
            <div
              key={index}
              className="flex-1 animate-pulse rounded-t bg-slate-800/80"
              style={{ height: `${height}%` }}
            />
          ))}
        </div>
      ) : totalErrors === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-800 bg-slate-900 text-slate-600">
            <AlertIcon className="h-5 w-5" />
          </span>
          <p className="text-sm text-slate-400">No errors in this window</p>
          <p className="text-xs text-slate-600">Try widening the time range or clearing filters.</p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={series} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="label"
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: '#1e293b' }}
              minTickGap={24}
            />
            <YAxis
              stroke="#64748b"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: 'rgba(148, 163, 184, 0.06)' }}
            />
            <Bar
              dataKey="count"
              fill="#f87171"
              radius={[4, 4, 0, 0]}
              maxBarSize={36}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  </section>
);
