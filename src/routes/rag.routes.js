import { Router } from 'express';
import { analyzeRag } from '../controllers/rag.controller.js';

export const ragRouter = Router();

ragRouter.post('/', analyzeRag);
