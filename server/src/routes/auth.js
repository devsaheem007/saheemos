import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { User } from '../models/index.js';
import { env } from '../config/env.js';
import { permissionsFor } from '../config/permissions.js';
import { asyncHandler, AppError, validate } from '../utils/errors.js';
import { protect, signToken, cookieOptions, COOKIE } from '../middleware/security.js';
import { sendMail } from '../utils/mailer.js';
import { audit } from '../utils/audit.js';

const r = express.Router();
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;

export const passwordSchema = z.string().min(10, 'Use at least 10 characters')
  .regex(/[a-z]/, 'Include a lowercase letter').regex(/[A-Z]/, 'Include an uppercase letter').regex(/\d/, 'Include a number');

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many attempts. Try again later.' } });
const publicUser = (u) => ({ _id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone, profileId: u.profileId, mustChangePassword: u.mustChangePassword });
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

r.post('/login', loginLimiter, validate(z.object({ email: z.string().email(), password: z.string().min(1) })), asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const generic = new AppError(401, 'Incorrect email or password');
  if (!user) { await bcrypt.compare(password, DUMMY_HASH); throw generic; }
  if (user.lockUntil && user.lockUntil > new Date()) throw new AppError(423, 'Account temporarily locked after too many failed attempts. Try again in a few minutes.');
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    user.failedLogins += 1;
    if (user.failedLogins >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MS); user.failedLogins = 0; }
    await user.save();
    throw generic;
  }
  if (!user.active) throw new AppError(403, 'This account is deactivated. Contact the school office.');
  user.failedLogins = 0; user.lockUntil = undefined; user.lastLoginAt = new Date();
  await user.save();
  res.cookie(COOKIE, signToken(user), cookieOptions());
  req.user = user; audit(req, 'login', 'auth', user._id);
  res.json({ user: publicUser(user), permissions: permissionsFor(user.role) });
}));

r.post('/logout', (req, res) => { res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined }); res.json({ ok: true }); });

r.get('/me', protect, (req, res) => res.json({ user: publicUser(req.user), permissions: permissionsFor(req.user.role) }));

r.post('/forgot', loginLimiter, validate(z.object({ email: z.string().email() })), asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase(), active: true });
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');
    user.resetExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();
    await sendMail({ to: user.email, subject: 'Reset your SaheemOS password', text: `Use this link within 1 hour to set a new password:\n${env.clientUrl}/reset/${token}\n\nIf you did not ask for this, ignore this email.` });
  }
  res.json({ message: 'If that email belongs to an account, a reset link has been sent.' }); // same reply either way
}));

r.post('/reset/:token', loginLimiter, validate(z.object({ password: passwordSchema })), asyncHandler(async (req, res) => {
  const hash = crypto.createHash('sha256').update(req.params.token).digest('hex');
  const user = await User.findOne({ resetTokenHash: hash, resetExpires: { $gt: new Date() } }).select('+resetTokenHash +resetExpires +passwordHash');
  if (!user) throw new AppError(400, 'This reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.resetTokenHash = undefined; user.resetExpires = undefined;
  user.tokenVersion += 1; user.mustChangePassword = false; user.failedLogins = 0; user.lockUntil = undefined;
  await user.save();
  res.json({ message: 'Password updated. You can sign in now.' });
}));

r.post('/change-password', protect, validate(z.object({ current: z.string().min(1), password: passwordSchema })), asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.current, user.passwordHash))) throw new AppError(400, 'Current password is incorrect');
  user.passwordHash = await bcrypt.hash(req.body.password, 12);
  user.tokenVersion += 1; user.mustChangePassword = false;
  await user.save();
  res.cookie(COOKIE, signToken(user), cookieOptions()); // keep this session alive, revoke all others
  audit(req, 'change-password', 'auth', user._id);
  res.json({ message: 'Password changed' });
}));

r.patch('/profile', protect, validate(z.object({ name: z.string().min(2).max(80), phone: z.string().max(30).optional() })), asyncHandler(async (req, res) => {
  req.user.name = req.body.name; if (req.body.phone !== undefined) req.user.phone = req.body.phone;
  await req.user.save();
  res.json({ user: publicUser(req.user) });
}));

export default r;
