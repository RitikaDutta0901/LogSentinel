import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from './components/Sidebar.jsx';
import { Header } from './components/Header.jsx';
import { StatCards } from './components/StatCards.jsx';
import { ErrorChart } from './components/ErrorChart.jsx';
import { LogStream } from './components/LogStream.jsx';
import { AnalysisModal } from './components/AnalysisModal.jsx';
import { SemanticSearchModal } from './components/SemanticSearchModal.jsx';
import { DEFAULT_FILTERS, TIME_RANGES } from './constants.js';
import { useDebouncedValue } from './hooks/useDebouncedValue.js';
import { useDashboardData } from './hooks/useDashboardData.js';
import { buildChartSeries } from './utils/chart.js';

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [live, setLive] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [semanticOpen, setSemanticOpen] = useState(false);

  const debouncedSearch = useDebouncedValue(searchInput, 350);

  const activeFilters = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const {
    logs,
    services,
    stats,
    pagination,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  } = useDashboardData({ filters: activeFilters, page, limit, live });

  const chartSeries = useMemo(() => buildChartSeries(stats), [stats]);
  const totalErrors = useMemo(
    () => chartSeries.reduce((sum, point) => sum + point.count, 0),
    [chartSeries],
  );

  useEffect(() => {
    const totalPages = pagination?.totalPages ?? 0;
    if (totalPages > 0 && page > totalPages) {
      setPage(totalPages);
    }
  }, [pagination, page]);

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const handleLimitChange = (value) => {
    setLimit(value);
    setPage(1);
  };

  const handleReset = () => {
    setFilters(DEFAULT_FILTERS);
    setSearchInput('');
    setPage(1);
  };

  const closeAnalysis = useCallback(() => setAnalysisOpen(false), []);
  const closeSemanticSearch = useCallback(() => setSemanticOpen(false), []);

  const windowLabel =
    TIME_RANGES.find((range) => range.value === filters.timeRange)?.label ?? 'Custom range';

  return (
    <div className="flex min-h-screen bg-slate-950">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        filters={filters}
        searchInput={searchInput}
        onSearchChange={setSearchInput}
        onFilterChange={handleFilterChange}
        limit={limit}
        onLimitChange={handleLimitChange}
        services={services}
        live={live}
        onToggleLive={() => setLive((value) => !value)}
        onReset={handleReset}
      />

      <main className="min-w-0 flex-1 bg-[radial-gradient(1100px_520px_at_18%_-10%,rgba(14,165,233,0.08),transparent)]">
        <div className="mx-auto max-w-[1500px] px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
          <Header
            onOpenSidebar={() => setSidebarOpen(true)}
            live={live}
            onToggleLive={() => setLive((value) => !value)}
            onRefresh={refresh}
            refreshing={refreshing}
            lastUpdated={lastUpdated}
            onOpenSemanticSearch={() => setSemanticOpen(true)}
          />

          <StatCards
            totalLogs={pagination?.total ?? 0}
            totalErrors={totalErrors}
            totalServices={services.length}
            windowLabel={windowLabel}
            loading={loading}
          />

          <div className="mt-4">
            <ErrorChart
              series={chartSeries}
              totalErrors={totalErrors}
              loading={loading}
              onAnalyze={() => setAnalysisOpen(true)}
            />
          </div>

          <div className="mt-4">
            <LogStream
              logs={logs}
              loading={loading}
              error={error}
              pagination={pagination}
              page={page}
              onPageChange={setPage}
              onRetry={refresh}
            />
          </div>

          <footer className="mt-5 flex flex-col gap-1 text-[11px] text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <span>LogSentinel · centralized log aggregation</span>
            <span>
              {live ? 'Live tail enabled' : 'Live tail paused'}
              {lastUpdated ? ` · last sync ${lastUpdated.toLocaleTimeString()}` : ''}
            </span>
          </footer>
        </div>
      </main>

      <AnalysisModal open={analysisOpen} onClose={closeAnalysis} />
      <SemanticSearchModal open={semanticOpen} onClose={closeSemanticSearch} />
    </div>
  );
}
