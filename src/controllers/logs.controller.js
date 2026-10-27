import { parseLogQuery } from '../validators/logs.validator.js';
import { searchLogs, listServices, getErrorStats } from '../repositories/log.repository.js';

export const getLogs = async (req, res, next) => {
  try {
    const options = parseLogQuery(req.query);
    const { logs, total } = await searchLogs(options);
    const totalPages = total === 0 ? 0 : Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: logs,
      pagination: {
        page: options.page,
        limit: options.limit,
        total,
        totalPages,
        hasNext: options.page < totalPages,
        hasPrev: options.page > 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getServices = async (req, res, next) => {
  try {
    const services = await listServices();
    res.status(200).json({ success: true, data: services });
  } catch (error) {
    next(error);
  }
};

export const getStats = async (req, res, next) => {
  try {
    const { since, serviceName, search } = parseLogQuery(req.query);
    const stats = await getErrorStats({ since, serviceName, search });

    res.status(200).json({
      success: true,
      intervalSeconds: stats.intervalSeconds,
      since: stats.since,
      data: stats.buckets,
    });
  } catch (error) {
    next(error);
  }
};
