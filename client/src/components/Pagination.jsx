import { ChevronLeftIcon, ChevronRightIcon } from './icons.jsx';
import { formatNumber } from '../utils/format.js';

export const Pagination = ({ pagination, page, loading, onPageChange }) => {
  if (!pagination) return null;

  const { total, limit, totalPages, hasPrev, hasNext } = pagination;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-col gap-3 border-t border-slate-800/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <p className="text-xs text-slate-500">
        Showing <span className="text-slate-300">{formatNumber(start)}</span>–
        <span className="text-slate-300">{formatNumber(end)}</span> of{' '}
        <span className="text-slate-300">{formatNumber(total)}</span>
      </p>

      <div className="flex items-center gap-2">
        <span className="mr-1 text-xs text-slate-500">
          Page {totalPages === 0 ? 0 : page} of {formatNumber(totalPages)}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={!hasPrev || loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Prev
        </button>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={!hasNext || loading}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRightIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
