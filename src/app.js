import express from 'express';
import { healthRouter } from './routes/health.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  app.use('/health', healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
