import { ValidationError } from '../errors/ValidationError.js';

const MAX_QUERY_LENGTH = 1000;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export const validateRagQuery = (payload) => {
  if (!isPlainObject(payload)) {
    throw new ValidationError('Request body must be a JSON object');
  }

  if (typeof payload.query !== 'string') {
    throw new ValidationError('"query" is required and must be a string');
  }

  const query = payload.query.trim();

  if (query === '') {
    throw new ValidationError('"query" cannot be empty');
  }

  if (query.length > MAX_QUERY_LENGTH) {
    throw new ValidationError(`"query" must be at most ${MAX_QUERY_LENGTH} characters`);
  }

  return query;
};
