import { analyzeWithRag } from '../services/rag.service.js';
import { validateRagQuery } from '../validators/rag.validator.js';

export const analyzeRag = async (req, res, next) => {
  try {
    const query = validateRagQuery(req.body);
    const result = await analyzeWithRag(query);

    res.status(200).json({
      success: true,
      analyzedAt: new Date().toISOString(),
      ...result,
    });
  } catch (error) {
    next(error);
  }
};
