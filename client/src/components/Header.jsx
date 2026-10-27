import { MenuIcon, RefreshIcon } from './icons.jsx';
import { formatClock } from '../utils/format.js';

export const Header = ({
  onOpenSidebar,
  live,
  onToggleLive,
  onRefresh,
  refreshing,
  lastUpdated,
}) => (
  <header className="mb-6 flex flex-col gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-center sm:justify-between">
    <div className="flex items-start gap-3">
      <button
        type="button"
        onClick={onOpenSidebar}
        className="mt-0.5 rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-400 transition hover:text-slate-200 lg:hidden"
        aria-label="Open filters"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-white">Overview</h1>
        <p className="mt-1 text-sm text-slate-400">
          Search and monitor logs across your services in real time.
        </p>
      </div>
    </div>

    <div className="flex items-center gap-2 self-start sm:self-auto">
      {lastUpdated && (
        <span className="hidden text-xs text-slate-500 sm:inline">
          Updated {formatClock(lastUpdated)}
        </span>
      )}
      <button
        type="button"
        onClick={onToggleLive}
        className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
          live
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:text-slate-200'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {live && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          )}
          <span
            className={`relative inline-flex h-2 w-2 rounded-full ${
              live ? 'bg-emerald-400' : 'bg-slate-600'
            }`}
          />
        </span>
        {live ? 'Live' : 'Paused'}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshIcon className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        Refresh
      </button>
    </div>
  </header>
);
