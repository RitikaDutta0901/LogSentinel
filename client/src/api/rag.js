export const analyzeRag = async (query, signal) => {
  const response = await fetch('/api/analyze-rag', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ query }),
    signal,
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(body?.error ?? `Semantic search failed with status ${response.status}`);
  }

  return body;
};
