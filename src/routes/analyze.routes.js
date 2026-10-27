import { Router } from 'express';
import { analyzeErrors } from '../controllers/analyze.controller.js';

export const analyzeRouter = Router();

analyzeRouter.post('/', analyzeErrors);
