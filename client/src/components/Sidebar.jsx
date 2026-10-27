import { LEVEL_OPTIONS, PAGE_SIZES, TIME_RANGES } from '../constants.js';
import {
  ChevronDownIcon,
  CloseIcon,
  RefreshIcon,
  SearchIcon,
  ShieldIcon,
} from './icons.jsx';

const LEVEL_ACTIVE = {
  '': 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  INFO: 'border-sky-500/40 bg-sky-500/10 text-sky-300',
  WARN: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  ERROR: 'border-red-500/40 bg-red-500/10 text-red-300',
};

const Field = ({ label, htmlFor, children }) => (
  <div className="space-y-2">
    <label
      htmlFor={htmlFor}
      className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500"
    >
      {label}
    </label>
    {children}
  </div>
);

const SelectShell = ({ children }) => (
  <div className="relative">
    {children}
    <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
  </div>
);

const selectClasses =
  'w-full appearance-none rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2.5 pr-9 text-sm text-slate-200 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20';

export const Sidebar = ({
  open,
  onClose,
  filters,
  searchInput,
  onSearchChange,
  onFilterChange,
  limit,
  onLimitChange,
  services,
  live,
  onToggleLive,
  onReset,
}) => (
  <>
    <button
      type="button"
      aria-label="Close filters"
      onClick={onClose}
      className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity lg:hidden ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
    />

    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-72 shrink-0 flex-col border-r border-slate-800/80 bg-slate-950 transition-transform duration-200 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-800/80 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-lg shadow-sky-500/20">
            <ShieldIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold tracking-wide text-white">LogSentinel</p>
            <p className="text-[11px] text-slate-500">Observability</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-900 hover:text-slate-300 lg:hidden"
          aria-label="Close sidebar"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-6">
        <Field label="Search logs" htmlFor="log-search">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              id="log-search"
              type="search"
              value={searchInput}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Payment failed..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900/70 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
            />
          </div>
        </Field>

        <Field label="Time range" htmlFor="time-range">
          <SelectShell>
            <select
              id="time-range"
              value={filters.timeRange}
              onChange={(event) => onFilterChange('timeRange', event.target.value)}
              className={selectClasses}
            >
              {TIME_RANGES.map((range) => (
                <option key={range.value} value={range.value}>
                  {range.label}
                </option>
              ))}
            </select>
          </SelectShell>
        </Field>

        <Field label="Log level">
          <div className="grid grid-cols-2 gap-2">
            {LEVEL_OPTIONS.map((option) => {
              const active = filters.level === option.value;
              return (
                <button
                  key={option.value || 'all'}
                  type="button"
                  onClick={() => onFilterChange('level', option.value)}
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    active
                      ? LEVEL_ACTIVE[option.value]
                      : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Service" htmlFor="service-filter">
          <SelectShell>
            <select
              id="service-filter"
              value={filters.serviceName}
              onChange={(event) => onFilterChange('serviceName', event.target.value)}
              className={selectClasses}
            >
              <option value="">All services</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
          </SelectShell>
        </Field>

        <Field label="Rows per page" htmlFor="page-size">
          <SelectShell>
            <select
              id="page-size"
              value={limit}
              onChange={(event) => onLimitChange(Number(event.target.value))}
              className={selectClasses}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </SelectShell>
        </Field>

        <div className="space-y-2">
          <button
            type="button"
            onClick={onToggleLive}
            className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 transition ${
              live
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
            }`}
          >
            <span className="flex items-center gap-2 text-xs font-medium text-slate-200">
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
              Live tail
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider ${
                live ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {live ? 'On' : 'Paused'}
            </span>
          </button>

          <button
            type="button"
            onClick={onReset}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2.5 text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
          >
            <RefreshIcon className="h-3.5 w-3.5" />
            Reset filters
          </button>
        </div>
      </div>

      <div className="border-t border-slate-800/80 px-5 py-4">
        <p className="text-[11px] text-slate-600">Log aggregation &amp; search · v1.0</p>
      </div>
    </aside>
  </>
);
