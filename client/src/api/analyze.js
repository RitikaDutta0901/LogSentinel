export const analyzeErrors = async (signal) => {
  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { Accept: 'application/json' },
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? `Analysis failed with status ${response.status}`);
  }

  return body;
};
