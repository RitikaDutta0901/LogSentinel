import { ValidationError } from '../errors/ValidationError.js';

const LOG_LEVELS = new Set(['INFO', 'WARN', 'ERROR']);
const DURATION_PATTERN = /^(\d{1,4})(m|h|d)$/;
const DURATION_MS = {
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};
const MAX_SEARCH_LENGTH = 200;
const MAX_SERVICE_NAME_LENGTH = 255;
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

const getSingleValue = (value, field) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) {
    throw new ValidationError(`"${field}" must be provided only once`);
  }
  if (typeof value !== 'string') {
    throw new ValidationError(`"${field}" must be a string`);
  }
  return value;
};

const parsePositiveInteger = (value, field, fallback, max) => {
  if (value === undefined || value === '') return fallback;

  if (!/^\d+$/.test(value)) {
    throw new ValidationError(`"${field}" must be a positive integer`);
  }

  const parsed = Number.parseInt(value, 10);
  if (parsed < 1) {
    throw new ValidationError(`"${field}" must be greater than 0`);
  }

  if (max !== undefined && parsed > max) {
    throw new ValidationError(`"${field}" must be at most ${max}`);
  }

  return parsed;
};

const parseTimeRange = (value) => {
  if (value === undefined || value === '' || value.toLowerCase() === 'all') {
    return null;
  }

  const match = DURATION_PATTERN.exec(value.toLowerCase());
  if (!match) {
    throw new ValidationError('"timeRange" must be a duration like 15m, 1h, 24h, 7d, or "all"');
  }

  const amount = Number.parseInt(match[1], 10);
  const unit = match[2];
  if (amount < 1) {
    throw new ValidationError('"timeRange" must be greater than 0');
  }

  return new Date(Date.now() - amount * DURATION_MS[unit]);
};

export const parseLogQuery = (query) => {
  const timeRange = getSingleValue(query.timeRange, 'timeRange');
  const level = getSingleValue(query.level, 'level');
  const serviceName = getSingleValue(query.service_name, 'service_name');
  const search = getSingleValue(query.search, 'search');
  const page = parsePositiveInteger(getSingleValue(query.page, 'page'), 'page', DEFAULT_PAGE);
  const limit = parsePositiveInteger(
    getSingleValue(query.limit, 'limit'),
    'limit',
    DEFAULT_LIMIT,
    MAX_LIMIT,
  );

  let normalizedLevel = null;
  if (level !== undefined && level.trim() !== '') {
    normalizedLevel = level.trim().toUpperCase();
    if (!LOG_LEVELS.has(normalizedLevel)) {
      throw new ValidationError('"level" must be one of INFO, WARN, ERROR');
    }
  }

  let normalizedService = null;
  if (serviceName !== undefined && serviceName.trim() !== '') {
    normalizedService = serviceName.trim();
    if (normalizedService.length > MAX_SERVICE_NAME_LENGTH) {
      throw new ValidationError(`"service_name" must be at most ${MAX_SERVICE_NAME_LENGTH} characters`);
    }
  }

  let normalizedSearch = null;
  if (search !== undefined && search.trim() !== '') {
    normalizedSearch = search.trim();
    if (normalizedSearch.length > MAX_SEARCH_LENGTH) {
      throw new ValidationError(`"search" must be at most ${MAX_SEARCH_LENGTH} characters`);
    }
  }

  return {
    since: parseTimeRange(timeRange),
    level: normalizedLevel,
    serviceName: normalizedService,
    search: normalizedSearch,
    page,
    limit,
    offset: (page - 1) * limit,
  };
};
