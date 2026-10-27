import { analyzeRecentErrors } from '../services/analysis.service.js';

export const analyzeErrors = async (req, res, next) => {
  try {
    const { sampleSize, analysis } = await analyzeRecentErrors();

    if (sampleSize === 0) {
      return res.status(200).json({
        success: true,
        sampleSize: 0,
        analysis: null,
        message: 'No ERROR logs are available to analyze',
      });
    }

    res.status(200).json({
      success: true,
      sampleSize,
      analyzedAt: new Date().toISOString(),
      analysis,
    });
  } catch (error) {
    next(error);
  }
};
