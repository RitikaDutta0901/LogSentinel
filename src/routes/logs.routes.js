import { Router } from 'express';
import { getLogs, getServices, getStats } from '../controllers/logs.controller.js';

export const logsRouter = Router();

logsRouter.get('/', getLogs);
logsRouter.get('/services', getServices);
logsRouter.get('/stats', getStats);
