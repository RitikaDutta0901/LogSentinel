import { useEffect, useState } from 'react';
import { analyzeErrors } from '../api/analyze.js';
import {
  AlertIcon,
  CheckIcon,
  CloseIcon,
  InboxIcon,
  SparklesIcon,
} from './icons.jsx';
import { formatDateTime } from '../utils/format.js';

const CONFIDENCE_STYLES = {
  high: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  medium: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  low: 'border-slate-600 bg-slate-800/60 text-slate-300',
};

const LoadingState = () => (
  <div className="space-y-5 px-5 py-6">
    <div className="flex items-center gap-2 text-sm text-slate-300">
      <SparklesIcon className="h-4 w-4 animate-pulse text-violet-400" />
      Analyzing recent error patterns...
    </div>
    <div className="h-24 animate-pulse rounded-xl bg-slate-800/70" />
    <div className="space-y-2">
      <div className="h-3 w-3/4 animate-pulse rounded bg-slate-800" />
      <div className="h-3 w-full animate-pulse rounded bg-slate-800" />
      <div className="h-3 w-2/3 animate-pulse rounded bg-slate-800" />
    </div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="h-28 animate-pulse rounded-xl bg-slate-800/70" />
      <div className="h-28 animate-pulse rounded-xl bg-slate-800/70" />
    </div>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
    <span className="grid h-11 w-11 place-items-center rounded-full border border-red-500/25 bg-red-500/10 text-red-400">
      <AlertIcon className="h-5 w-5" />
    </span>
    <div>
      <p className="text-sm font-medium text-slate-200">Analysis failed</p>
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

const EmptyState = () => (
  <div className="flex flex-col items-center gap-3 px-5 py-12 text-center">
    <span className="grid h-11 w-11 place-items-center rounded-full border border-slate-700 bg-slate-800/60 text-slate-500">
      <InboxIcon className="h-5 w-5" />
    </span>
    <div>
      <p className="text-sm font-medium text-slate-200">No ERROR logs to analyze</p>
      <p className="mt-1 text-xs text-slate-500">
        Ingest some ERROR events, then run the analysis again.
      </p>
    </div>
  </div>
);

const AnalysisResult = ({ result }) => {
  const { analysis, analyzedAt, sampleSize } = result;
  const confidence = analysis.confidence ?? 'low';

  return (
    <div className="space-y-5 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${
            CONFIDENCE_STYLES[confidence] ?? CONFIDENCE_STYLES.low
          }`}
        >
          {confidence} confidence
        </span>
        <span className="text-[11px] text-slate-500">
          {sampleSize} ERROR events · {formatDateTime(analyzedAt)}
        </span>
      </div>

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

      <p className="border-t border-slate-800 pt-3 text-[11px] leading-relaxed text-slate-600">
        AI-generated guidance based on log patterns. Verify against system metrics before acting.
      </p>
    </div>
  );
};

export const AnalysisModal = ({ open, onClose }) => {
  const [status, setStatus] = useState('idle');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;

    const controller = new AbortController();
    setStatus('loading');
    setResult(null);
    setError(null);

    analyzeErrors(controller.signal)
      .then((body) => {
        setResult(body);
        setStatus('success');
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return;
        setError(requestError.message);
        setStatus('error');
      });

    return () => controller.abort();
  }, [open, attempt]);

  useEffect(() => {
    if (!open) return;

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

  const noLogs = status === 'success' && (result?.sampleSize ?? 0) === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-title"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/50 sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-sky-500 text-white shadow-lg shadow-violet-500/20">
              <SparklesIcon className="h-5 w-5" />
            </span>
            <div>
              <h2 id="analysis-title" className="text-sm font-semibold text-white">
                AI error analysis
              </h2>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Latest 20 ERROR events · powered by Gemini
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close analysis"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {status === 'loading' && <LoadingState />}
        {status === 'error' && (
          <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} />
        )}
        {noLogs && <EmptyState />}
        {status === 'success' && !noLogs && result?.analysis && (
          <AnalysisResult result={result} />
        )}
      </div>
    </div>
  );
};
