import { useCallback, useEffect, useState } from 'react';
import { fetchLogs, fetchServices, fetchStats } from '../api/logs.js';
import { POLL_INTERVAL_MS } from '../constants.js';

const buildParams = (filters) => ({
  timeRange: filters.timeRange,
  level: filters.level,
  service_name: filters.serviceName,
  search: filters.search,
});

export const useDashboardData = ({ filters, page, limit, live }) => {
  const [logs, setLogs] = useState([]);
  const [services, setServices] = useState([]);
  const [stats, setStats] = useState({ data: [], since: null, intervalSeconds: 3600 });
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((value) => value + 1), []);

  const queryKey = [
    filters.timeRange,
    filters.level,
    filters.serviceName,
    filters.search,
    page,
    limit,
  ].join('|');

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    let inFlight = false;

    const load = async (showSkeleton) => {
      if (inFlight) return;
      inFlight = true;

      if (showSkeleton) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const params = buildParams(filters);
      const query = {
        ...params,
        page,
        limit,
      };

      try {
        const [logsResponse, servicesResponse, statsResponse] = await Promise.all([
          fetchLogs(query, controller.signal),
          fetchServices(controller.signal),
          fetchStats(params, controller.signal),
        ]);

        if (cancelled) return;

        setLogs(logsResponse.data ?? []);
        setPagination(logsResponse.pagination ?? null);
        setServices(servicesResponse.data ?? []);
        setStats({
          data: statsResponse.data ?? [],
          since: statsResponse.since ?? null,
          intervalSeconds: statsResponse.intervalSeconds ?? 3600,
        });
        setLastUpdated(new Date());
      } catch (requestError) {
        if (cancelled || requestError.name === 'AbortError') return;
        setError(requestError.message);
      } finally {
        inFlight = false;
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    load(true);

    let timer;
    if (live) {
      timer = setInterval(() => load(false), POLL_INTERVAL_MS);
    }

    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(timer);
    };
  }, [queryKey, live, refreshKey]);

  return {
    logs,
    services,
    stats,
    pagination,
    loading,
    refreshing,
    error,
    lastUpdated,
    refresh,
  };
};
