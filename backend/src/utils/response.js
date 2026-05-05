export const buildMeta = (req, extra = {}) => ({
  timestamp: new Date().toISOString(),
  requestId: req.id,
  executionTime: req.executionTimeMs ? `${req.executionTimeMs}ms` : undefined,
  ...extra,
});

export const successResponse = (res, req, statusCode, data, extraMeta = {}) => {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: buildMeta(req, extraMeta),
  });
};

export const errorResponse = (res, req, statusCode, code, message, details = undefined) => {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
      details,
    },
    meta: buildMeta(req),
  });
};
