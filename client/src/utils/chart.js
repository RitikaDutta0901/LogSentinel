import { formatBucketLabel } from './format.js';

export const buildChartSeries = (stats) => {
  const intervalSeconds = stats?.intervalSeconds ?? 3600;
  const step = intervalSeconds * 1000;
  const rows = stats?.data ?? [];
  const counts = new Map(
    rows.map((row) => [new Date(row.bucket).getTime(), row.count]),
  );

  if (!stats?.since) {
    return rows.map((row) => {
      const timestamp = new Date(row.bucket).getTime();
      return {
        timestamp,
        count: row.count,
        label: formatBucketLabel(timestamp, intervalSeconds),
      };
    });
  }

  const start = new Date(stats.since).getTime();
  const end = Date.now();
  const firstBucket = Math.floor(start / step) * step;
  const series = [];

  for (let timestamp = firstBucket; timestamp <= end; timestamp += step) {
    series.push({
      timestamp,
      count: counts.get(timestamp) ?? 0,
      label: formatBucketLabel(timestamp, intervalSeconds),
    });
  }

  return series;
};
