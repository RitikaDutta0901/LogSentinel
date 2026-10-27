const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const clockFormatter = new Intl.DateTimeFormat(undefined, {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const dayTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dayFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
});

const numberFormatter = new Intl.NumberFormat();

export const formatDateTime = (value) => dateTimeFormatter.format(new Date(value));

export const formatClock = (value) => clockFormatter.format(new Date(value));

export const formatNumber = (value) => numberFormatter.format(value ?? 0);

export const formatBucketLabel = (timestamp, intervalSeconds) => {
  const date = new Date(timestamp);

  if (intervalSeconds >= 86_400) return dayFormatter.format(date);
  if (intervalSeconds >= 21_600) return dayTimeFormatter.format(date);

  return clockFormatter.format(date);
};
