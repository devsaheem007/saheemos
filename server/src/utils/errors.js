import { ZodError } from 'zod';
import { env } from '../config/env.js';

export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

export function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req[source]);
    if (!parsed.success) {
      return next(new AppError(400, 'Validation failed', parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))));
    }
    req[source] = parsed.data;
    next();
  };
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let message = err.message || 'Server error';
  let details = err.details;

  if (err instanceof ZodError) { status = 400; message = 'Validation failed'; details = err.issues; }
  else if (err.name === 'ValidationError' && err.errors) {
    status = 400; message = 'Validation failed';
    details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
  } else if (err.name === 'CastError') { status = 400; message = `Invalid value for ${err.path}`; }
  else if (err.code === 11000) {
    status = 409;
    message = `Duplicate value for ${Object.keys(err.keyPattern || {}).join(', ') || 'a unique field'}`;
  } else if (err.name === 'MulterError') { status = 400; }

  if (status >= 500) console.error(err);
  res.status(status).json({ message: status >= 500 && env.isProd ? 'Server error' : message, details });
}
