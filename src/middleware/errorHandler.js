export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (error, req, res, next) => {
  const statusCode = error.statusCode ?? 500;

  if (statusCode >= 500) {
    console.error('[error]', error.stack ?? error.message);
  }

  res.status(statusCode).json({
    success: false,
    error: statusCode >= 500 ? 'Internal server error' : error.message,
  });
};
