// Wrap async routes to catch errors
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Validate required query parameters
export const requireQueryParams = (params) => (req, res, next) => {
  const missing = params.filter(p => !req.query[p]);
  if (missing.length) return res.status(400).json({ error: `Missing query params: ${missing.join(', ')}` });
  next();
};

// Process uploaded file to base64
export const processFile = (file) => {
  if (!file) return null;
  return { data: file.buffer.toString('base64'), contentType: file.mimetype };
};