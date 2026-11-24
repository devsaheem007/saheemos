import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { can } from '../config/permissions.js';
import { AppError, asyncHandler } from '../utils/errors.js';
import { sanitize } from '../utils/sanitize.js';

export const sanitizeInput = (req, _res, next) => {
  if (req.body) req.body = sanitize(req.body);
  if (req.query) req.query = sanitize(req.query);
  if (req.params) req.params = sanitize(req.params);
  next();
};

// CSRF defence for cookie auth: state-changing requests must carry a custom header,
// which cross-site forms cannot send and cross-origin fetches cannot send without CORS approval.
export const csrfGuard = (req, _res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (req.get('X-Requested-With') !== 'SaheemOS') return next(new AppError(403, 'Missing CSRF header'));
  next();
};

export const COOKIE = 'saheemos_token';
export const cookieOptions = () => ({
  httpOnly: true,
  secure: env.isProd,
  sameSite: 'lax',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
});

export const signToken = (user) =>
  jwt.sign({ id: user._id, tv: user.tokenVersion }, env.jwtSecret, { expiresIn: env.jwtExpires });

export const protect = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new AppError(401, 'Please sign in');
  let payload;
  try { payload = jwt.verify(token, env.jwtSecret); } catch { throw new AppError(401, 'Session expired. Please sign in again'); }
  const user = await User.findById(payload.id);
  if (!user || !user.active || user.tokenVersion !== payload.tv) throw new AppError(401, 'Session expired. Please sign in again');
  req.user = user;
  next();
});

export const requirePerm = (resource, action) => (req, _res, next) => {
  if (!can(req.user.role, resource, action)) return next(new AppError(403, 'You do not have permission to do this'));
  next();
};

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.role)) return next(new AppError(403, 'You do not have permission to do this'));
  next();
};
