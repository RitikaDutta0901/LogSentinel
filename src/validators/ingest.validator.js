import { ValidationError } from '../errors/ValidationError.js';

const LOG_LEVELS = new Set(['INFO', 'WARN', 'ERROR']);
const MAX_BATCH_SIZE = 1000;
const MAX_MESSAGE_LENGTH = 16_384;
const MAX_SERVICE_NAME_LENGTH = 255;
const MAX_METADATA_BYTES = 64 * 1024;
const MAX_REPORTED_ERRORS = 20;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const extractLogs = (payload) => {
  if (payload === undefined || payload === null) {
    throw new ValidationError('Request body is required');
  }

  if (Array.isArray(payload)) {
    if (payload.length === 0) {
      throw new ValidationError('No logs provided');
    }
    return payload;
  }

  if (!isPlainObject(payload)) {
    throw new ValidationError('Request body must be a log object or an array of logs');
  }

  if ('logs' in payload) {
    if (!Array.isArray(payload.logs)) {
      throw new ValidationError('"logs" must be an array');
    }
    if (payload.logs.length === 0) {
      throw new ValidationError('No logs provided');
    }
    return payload.logs;
  }

  if (Object.keys(payload).length === 0) {
    throw new ValidationError('Request body is empty');
  }

  return [payload];
};

const validateLog = (log, index, errors) => {
  if (!isPlainObject(log)) {
    errors.push({ index, field: 'body', message: 'Log entry must be an object' });
    return null;
  }

  const serviceName = typeof log.service_name === 'string' ? log.service_name.trim() : '';
  if (!serviceName) {
    errors.push({ index, field: 'service_name', message: 'service_name is required' });
  } else if (serviceName.length > MAX_SERVICE_NAME_LENGTH) {
    errors.push({
      index,
      field: 'service_name',
      message: `service_name must be at most ${MAX_SERVICE_NAME_LENGTH} characters`,
    });
  }

  const rawLevel = typeof log.log_level === 'string' ? log.log_level.trim().toUpperCase() : '';
  if (!rawLevel) {
    errors.push({ index, field: 'log_level', message: 'log_level is required' });
  } else if (!LOG_LEVELS.has(rawLevel)) {
    errors.push({
      index,
      field: 'log_level',
      message: 'log_level must be one of INFO, WARN, ERROR',
    });
  }

  if (typeof log.message !== 'string' || log.message.trim() === '') {
    errors.push({ index, field: 'message', message: 'message is required' });
  } else if (log.message.length > MAX_MESSAGE_LENGTH) {
    errors.push({
      index,
      field: 'message',
      message: `message must be at most ${MAX_MESSAGE_LENGTH} characters`,
    });
  }

  let timestamp = null;
  if (log.timestamp !== undefined && log.timestamp !== null) {
    const parsed = new Date(log.timestamp);
    if (Number.isNaN(parsed.getTime())) {
      errors.push({
        index,
        field: 'timestamp',
        message: 'timestamp must be a valid ISO 8601 date',
      });
    } else {
      timestamp = parsed.toISOString();
    }
  }

  let metadata = {};
  if (log.metadata !== undefined && log.metadata !== null) {
    if (!isPlainObject(log.metadata)) {
      errors.push({ index, field: 'metadata', message: 'metadata must be an object' });
    } else if (Buffer.byteLength(JSON.stringify(log.metadata), 'utf8') > MAX_METADATA_BYTES) {
      errors.push({
        index,
        field: 'metadata',
        message: `metadata must be at most ${MAX_METADATA_BYTES} bytes`,
      });
    } else {
      metadata = log.metadata;
    }
  }

  if (errors.length > 0) return null;

  return {
    serviceName,
    logLevel: rawLevel,
    message: log.message,
    timestamp,
    metadata,
  };
};

export const validateIngestPayload = (payload) => {
  const rawLogs = extractLogs(payload);

  if (rawLogs.length > MAX_BATCH_SIZE) {
    throw new ValidationError(`Batch size exceeds the limit of ${MAX_BATCH_SIZE} logs`);
  }

  const errors = [];
  const logs = [];

  rawLogs.forEach((log, index) => {
    if (errors.length >= MAX_REPORTED_ERRORS) return;
    const validated = validateLog(log, index, errors);
    if (validated) logs.push(validated);
  });

  if (errors.length > 0) {
    throw new ValidationError('Invalid log payload', errors);
  }

  return logs;
};
