const request = async (path, signal) => {
  const response = await fetch(path, { signal, headers: { Accept: 'application/json' } });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? `Request failed with status ${response.status}`);
  }

  return body;
};

const toQueryString = (params) => {
  const search = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });

  const query = search.toString();
  return query ? `?${query}` : '';
};

export const fetchLogs = (params, signal) =>
  request(`/api/logs${toQueryString(params)}`, signal);

export const fetchServices = (signal) => request('/api/logs/services', signal);

export const fetchStats = (params, signal) =>
  request(`/api/logs/stats${toQueryString(params)}`, signal);
