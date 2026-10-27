import { Router } from 'express';
import { ingestLogs } from '../controllers/ingest.controller.js';

export const ingestRouter = Router();

ingestRouter.post('/', ingestLogs);
