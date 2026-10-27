import { validateIngestPayload } from '../validators/ingest.validator.js';
import { enqueueLogs } from '../services/ingestion.service.js';

export const ingestLogs = (req, res, next) => {
  try {
    const logs = validateIngestPayload(req.body);
    const { buffered } = enqueueLogs(logs);

    res.status(202).json({
      success: true,
      accepted: logs.length,
      buffered,
    });
  } catch (error) {
    next(error);
  }
};
