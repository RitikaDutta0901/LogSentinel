export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode ?? error.status ?? 500;

  if (statusCode >= 500) {
    console.error('[error]', error.stack ?? error.message);
  }

  const message =
    error.type === 'entity.parse.failed'
      ? 'Invalid JSON payload'
      : statusCode >= 500 && !error.expose
        ? 'Internal server error'
        : error.message;

  const body = { success: false, error: message };
  if (Array.isArray(error.details) && error.details.length > 0) {
    body.details = error.details;
  }

  res.status(statusCode).json(body);
};
