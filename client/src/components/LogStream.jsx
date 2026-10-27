import { Fragment, useState } from 'react';
import { LevelBadge } from './LevelBadge.jsx';
import { Pagination } from './Pagination.jsx';
import { ChevronDownIcon, InboxIcon, RowsIcon } from './icons.jsx';
import { formatDateTime, formatNumber } from '../utils/format.js';

const SkeletonRows = () => (
  <>
    {Array.from({ length: 8 }).map((_, rowIndex) => (
      <tr key={rowIndex} className="border-b border-slate-800/60">
        {[70, 40, 60, 220, 10].map((width, cellIndex) => (
          <td key={cellIndex} className="px-4 py-3">
            <div
              className="h-3 animate-pulse rounded bg-slate-800"
              style={{ width: `${width}px` }}
            />
          </td>
        ))}
      </tr>
    ))}
  </>
);

export const LogStream = ({
  logs,
  loading,
  error,
  pagination,
  page,
  onPageChange,
  onRetry,
}) => {
  const [expandedId, setExpandedId] = useState(null);

  const toggleRow = (id) => {
    setExpandedId((current) => (current === id ? null : id));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/50">
      <div className="flex flex-col gap-2 border-b border-slate-800/80 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <RowsIcon className="h-4 w-4 text-sky-400" />
          <h2 className="text-sm font-semibold text-white">Log stream</h2>
          <span className="rounded-full border border-slate-700 bg-slate-800/70 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {formatNumber(pagination?.total ?? 0)}
          </span>
        </div>
        <p className="text-[11px] text-slate-500">
          Newest first · click a row to inspect metadata
        </p>
      </div>

      {error && (
        <div className="flex flex-col gap-2 border-b border-red-500/20 bg-red-500/5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-red-300">Failed to load logs: {error}</p>
          <button
            type="button"
            onClick={onRetry}
            className="w-fit rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 transition hover:bg-red-500/20"
          >
            Retry
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-800/80 bg-slate-950/40 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              <th className="px-4 py-3 font-medium">Timestamp</th>
              <th className="px-4 py-3 font-medium">Level</th>
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Message</th>
              <th className="w-10 px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows />
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16">
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-800 bg-slate-900 text-slate-600">
                      <InboxIcon className="h-5 w-5" />
                    </span>
                    <p className="text-sm text-slate-400">No logs match these filters</p>
                    <p className="text-xs text-slate-600">
                      Try a wider time range, a different level, or clear the search.
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                const expanded = expandedId === log.id;
                const metadata = log.metadata ?? {};

                return (
                  <Fragment key={log.id}>
                    <tr
                      onClick={() => toggleRow(log.id)}
                      className={`cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-900/70 ${
                        expanded ? 'bg-slate-900/70' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-slate-400">
                        {formatDateTime(log.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <LevelBadge level={log.log_level} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-300">
                        {log.service_name}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="block max-w-[540px] truncate font-mono text-xs text-slate-300"
                          title={log.message}
                        >
                          {log.message}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          aria-expanded={expanded}
                          aria-label={expanded ? 'Hide metadata' : 'Show metadata'}
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleRow(log.id);
                          }}
                          className="rounded-md p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
                        >
                          <ChevronDownIcon
                            className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-b border-slate-800/60 bg-slate-950/60">
                        <td colSpan={5} className="px-4 py-4">
                          <div className="flex flex-col gap-4 lg:flex-row">
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Metadata
                              </p>
                              <pre className="mt-1.5 max-h-52 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
                                {JSON.stringify(metadata, null, 2)}
                              </pre>
                            </div>
                            <div className="lg:w-72">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                                Event ID
                              </p>
                              <p className="mt-1.5 break-all rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] text-slate-400">
                                {log.id}
                              </p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        pagination={pagination}
        page={page}
        loading={loading}
        onPageChange={onPageChange}
      />
    </section>
  );
};
