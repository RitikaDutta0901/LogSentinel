import { AlertIcon, ClockIcon, RowsIcon, ServerIcon } from './icons.jsx';
import { formatNumber } from '../utils/format.js';

const ACCENTS = {
  sky: 'border-sky-500/20 bg-sky-500/10 text-sky-400',
  red: 'border-red-500/20 bg-red-500/10 text-red-400',
  emerald: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
  indigo: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-400',
};

const Card = ({ label, value, subtitle, icon: Icon, accent, loading }) => (
  <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50 p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {loading ? (
          <div className="mt-3 h-7 w-20 animate-pulse rounded bg-slate-800" />
        ) : (
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-white">{value}</p>
        )}
        <p className="mt-1 text-[11px] text-slate-500">{subtitle}</p>
      </div>
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${ACCENTS[accent]}`}>
        <Icon className="h-4 w-4" />
      </span>
    </div>
  </div>
);

export const StatCards = ({ totalLogs, totalErrors, totalServices, windowLabel, loading }) => (
  <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <Card
      label="Matching logs"
      value={formatNumber(totalLogs)}
      subtitle="Across active filters"
      icon={RowsIcon}
      accent="sky"
      loading={loading}
    />
    <Card
      label="Errors"
      value={formatNumber(totalErrors)}
      subtitle="In the selected window"
      icon={AlertIcon}
      accent="red"
      loading={loading}
    />
    <Card
      label="Services"
      value={formatNumber(totalServices)}
      subtitle="Reporting to LogSentinel"
      icon={ServerIcon}
      accent="emerald"
      loading={loading}
    />
    <Card
      label="Time window"
      value={windowLabel}
      subtitle="Live tail refreshes every 5s"
      icon={ClockIcon}
      accent="indigo"
      loading={loading}
    />
  </section>
);
