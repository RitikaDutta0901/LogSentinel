import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeRag } from '../api/rag.js';
import { LevelBadge } from './LevelBadge.jsx';
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  InboxIcon,
  SearchIcon,
  SparklesIcon,
} from './icons.jsx';
import { formatDateTime } from '../utils/format.js';

const CONFIDENCE_STYLES = {
  high: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  low: 'border-slate-600 bg-slate-800/60 text-slate-300',
};

const EXAMPLE_QUERIES = [
  'Why did checkout payments fail?',
  'What caused database connection timeouts?',
  'Which errors point to a cascading failure?',
];

const LoadingState = () => (
  <div className="space-y-5 px-5 py-6">
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <SparklesIcon className="h-4 w-4 animate-pulse text-violet-400" />
      Finding similar ERROR logs and analyzing them...
    </div>
    <div className="h-24 animate-pulse rounded-xl bg-slate-800/70" />
    <div className="space-y-2">
      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
      <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
    </div>
    <div className="space-y-3">
      <div className="h-20 animate-pulse rounded-xl bg-slate-800/70" />
      <div className="h-20 animate-pulse rounded-xl bg-slate-800/70" />
    </div>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
    <span className="grid h-11 w-11 place-items-center rounded-full border border-red-500/25 bg-red-500/10 text-red-400">
      <AlertIcon className="h-5 w-5" />
    </span>
    <div>
      <p className="text-sm font-medium text-slate-200">Semantic search failed</p>
      <p className="mt-1 max-w-md text-xs text-slate-400">{message}</p>
    </div>
    <button
      type="button"
      onClick={onRetry}
      className="mt-1 rounded-lg border border-slate-700 bg-slate-800/70 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-800"
    >
      Try again
    </button>
  </div>
);

const RetrievedLog = ({ log }) => {
  const similarity = Math.round((Number(log.similarity) || 0) * 100);
  const metadata = log.metadata ?? {};
  const hasMetadata = Object.keys(metadata).length > 0;

  return (
    <li className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <LevelBadge level={log.log_level ?? 'ERROR'} />
        <span className="text-xs font-medium text-slate-300">{log.service}</span>
        <span className="font-mono text-[11px] text-slate-500">
          {formatDateTime(log.timestamp)}
        </span>
        <span className="ml-auto rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
          {similarity}% match
        </span>
      </div>

      <p className="mt-2 break-words font-mono text-xs leading-relaxed text-slate-300">
        {log.message}
      </p>

      {hasMetadata && (
        <pre className="mt-3 max-h-32 overflow-auto rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-[10px] leading-relaxed text-slate-400">
          {JSON.stringify(metadata, null, 2)}
        </pre>
      )}
    </li>
  );
};

const SearchResult = ({ result }) => {
  const { analysis, analyzedAt, contextCount, retrievedLogs, query } = result;
  const confidence = analysis.confidence ?? 'low';

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="rounded-xl border border-slate-800 bg-slate-950/50 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          Your query
        </p>
        <p className="mt-1 text-sm text-slate-200">{query}</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low
          }`}
        >
          {confidence} confidence
        </span>
        <span className="text-[11px] text-slate-500">
          {contextCount} related ERROR events · {formatDateTime(analyzedAt)}
        </span>
      </div>

      {contextCount === 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
          <InboxIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-xs leading-relaxed text-amber-200">
            No stored ERROR logs have embeddings yet, so the analysis has no retrieved context.
            Ingest some ERROR logs with GEMINI_API_KEY configured, then try again.
          </p>
        </div>
      )}

      <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">
          Suggested root cause
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-100">
          {analysis.suggestedRootCause}
        </p>
      </section>

      {analysis.summary && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Pattern summary
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-slate-300">{analysis.summary}</p>
        </section>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {analysis.evidence.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-sky-400">
              Evidence
            </h3>
            <ul className="mt-3 space-y-2">
              {analysis.evidence.map((item, index) => (
                <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-sky-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {analysis.recommendations.length > 0 && (
          <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <h3 className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
              Recommended actions
            </h3>
            <ul className="mt-3 space-y-2">
              {analysis.recommendations.map((item, index) => (
                <li key={index} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                  <CheckIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {retrievedLogs.length > 0 && (
        <section>
          <h3 className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Retrieved logs ({retrievedLogs.length})
          </h3>
          <ul className="mt-3 space-y-3">
            {retrievedLogs.map((log) => (
              <RetrievedLog key={log.id} log={log} />
            ))}
          </ul>
        </section>
      )}

      <p className="border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-600">
        Answers are grounded in semantically similar ERROR logs. Verify against system metrics
        before acting.
      </p>
    </div>
  );
};

export const SemanticSearchModal = ({ open, onClose }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const controllerRef = useRef(null);

  const runSearch = useCallback((value) => {
    const searchQuery = value.trim();
    if (!searchQuery) return;

    controllerRef.current?.abort();

    const controller = new AbortController();
    controllerRef.current = controller;

    setStatus('loading');
    setResult(null);
    setError(null);

    analyzeRag(searchQuery, controller.signal)
      .then((body) => {
        if (controller.signal.aborted) return;
        setResult(body);
        setStatus('success');
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError' || controller.signal.aborted) return;
        setError(requestError.message);
        setStatus('error');
      });
  }, []);

  const handleSubmit = (event) => {
    event.preventDefault();
    runSearch(query);
  };

  useEffect(() => {
    if (!open) return undefined;

    return () => {
      controllerRef.current?.abort();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const loading = status === 'loading';
  const canSearch = query.trim() !== '' && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="semantic-search-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-sky-500 to-violet-500 text-white shadow-lg shadow-sky-500/20">
              <SearchIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="semantic-search-title" className="text-sm font-semibold text-white">
                Semantic search
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Natural-language search over embedded ERROR logs · pgvector + Gemini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close semantic search"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="border-b border-slate-800 px-5 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Why did checkout payments fail?"
                autoFocus
                className="w-full rounded-lg border border-slate-800 bg-slate-950/70 py-2.5 pl-9 pr-3 text-sm text-slate-200 placeholder:text-slate-600 outline-none transition focus:border-sky-500/50 focus:ring-2 focus:ring-sky-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={!canSearch}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-sky-500/30 bg-gradient-to-r from-sky-500/20 to-violet-500/20 px-4 py-2.5 text-xs font-semibold text-sky-200 transition hover:from-sky-500/30 hover:to-violet-500/30 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <SparklesIcon className="h-3.5 w-3.5" />
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  runSearch(example);
                }}
                disabled={loading}
                className="rounded-full border border-slate-800 bg-slate-950/50 px-3 py-1 text-[11px] text-slate-400 transition hover:border-slate-700 hover:text-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {example}
              </button>
            ))}
          </div>
        </form>

        {status === 'idle' && (
          <div className="flex flex-col items-center gap-2 px-5 py-14 text-center">
            <span className="grid h-11 w-11 place-items-center rounded-full border border-slate-800 bg-slate-950 text-slate-600">
              <SearchIcon className="h-5 w-5" />
            </span>
            <p className="text-sm font-medium text-slate-300">Ask a question about past errors</p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              LogSentinel embeds ERROR messages, finds the most similar historical logs, and asks
              Gemini to explain the likely root cause.
            </p>
          </div>
        )}
        {loading && <LoadingState />}
        {status === 'error' && (
          <ErrorState message={error} onRetry={() => runSearch(query)} />
        )}
        {status === 'success' && result?.analysis && <SearchResult result={result} />}
      </div>
    </div>
  );
};
