import express from 'express';
import { healthRouter } from './routes/health.routes.js';
import { ingestRouter } from './routes/ingest.routes.js';
import { logsRouter } from './routes/logs.routes.js';
import { analyzeRouter } from './routes/analyze.routes.js';
import { ragRouter } from './routes/rag.routes.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export const createApp = () => {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb' }));

  app.use('/health', healthRouter);
  app.use('/api/ingest', ingestRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/analyze', analyzeRouter);
  app.use('/api/analyze-rag', ragRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
