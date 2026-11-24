import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Notification, Setting, Announcement, Inquiry, getSettings } from '../models/index.js';
import { asyncHandler, AppError, validate } from '../utils/errors.js';
import { requirePerm } from '../middleware/security.js';
import { audit } from '../utils/audit.js';
import { env } from '../config/env.js';
import { sendSms, smsEnabled } from '../utils/sms.js';

/* ---------------- Notifications (own only) ---------------- */
export const notifications = express.Router();
notifications.get('/', asyncHandler(async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort('-createdAt').limit(50).lean();
  res.json({ items, unread: await Notification.countDocuments({ user: req.user._id, read: false }) });
}));
notifications.post('/read-all', asyncHandler(async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); }));
notifications.post('/:id/read', asyncHandler(async (req, res) => { await Notification.updateOne({ _id: req.params.id, user: req.user._id }, { read: true }); res.json({ ok: true }); }));

/* ---------------- Settings (singleton) ---------------- */
export const settings = express.Router();
settings.get('/', requirePerm('settings', 'r'), asyncHandler(async (_req, res) => res.json({ ...(await getSettings()).toObject(), smsConfigured: smsEnabled() })));
settings.post('/test-sms', requirePerm('settings', 'u'), validate(z.object({ to: z.string().min(6).max(25) })), asyncHandler(async (req, res) => {
  res.json(await sendSms({ to: req.body.to, message: 'SaheemOS test message. SMS alerts are working.', kind: 'test' }));
}));
const EDITABLE = ['schoolName', 'tagline', 'logoUrl', 'address', 'phone', 'email', 'about', 'principalName', 'principalMessage', 'programs', 'facilities', 'admissionsInfo', 'payrollWorkingDays', 'gradeScale', 'smsAbsenceAlerts', 'smsFeeReminders'];
settings.put('/', requirePerm('settings', 'u'), asyncHandler(async (req, res) => {
  const s = await getSettings();
  for (const k of EDITABLE) if (req.body[k] !== undefined) s[k] = req.body[k];
  await s.save(); audit(req, 'update', 'settings', s._id);
  res.json(s);
}));

/* ---------------- Uploads ---------------- */
const ALLOWED = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx' };
const uploadDir = path.resolve(env.uploadDir);
fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (_req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + ALLOWED[file.mimetype]),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => (ALLOWED[file.mimetype] ? cb(null, true) : cb(new AppError(400, 'Only JPG, PNG, WebP, PDF, DOCX and XLSX files up to 5 MB are allowed'))),
});
export const uploads = express.Router();
uploads.post('/', upload.single('file'), (req, res) => {
  if (!req.file) throw new AppError(400, 'No file received');
  audit(req, 'upload', 'files', req.file.filename);
  res.status(201).json({ name: req.file.originalname.slice(0, 120), url: `/api/files/${req.file.filename}` });
});
// Files are only served to signed-in users. Names are 128-bit random, so they cannot be guessed.
export const files = express.Router();
files.get('/:name', (req, res) => {
  const name = path.basename(req.params.name);
  const full = path.join(uploadDir, name);
  if (!/^[a-f0-9]{32}\.(jpg|png|webp|pdf|docx|xlsx)$/.test(name) || !fs.existsSync(full)) throw new AppError(404, 'File not found');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, max-age=3600');
  res.sendFile(full);
});

/* ---------------- Public website API (no auth) ---------------- */
export const publicApi = express.Router();
const LOGO_RE = /^\/api\/files\/([a-f0-9]{32}\.(?:jpg|png|webp))$/;
// Serves ONLY the file currently set as the school logo. Other uploads stay private.
publicApi.get('/logo', asyncHandler(async (_req, res) => {
  const m = LOGO_RE.exec((await getSettings()).logoUrl || '');
  const full = m && path.join(uploadDir, m[1]);
  if (!m || !fs.existsSync(full)) throw new AppError(404, 'No logo');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(full);
}));
publicApi.get('/site', asyncHandler(async (_req, res) => {
  const s = (await getSettings()).toObject();
  const { schoolName, tagline, logoUrl, address, phone, email, about, principalName, principalMessage, programs, facilities, admissionsInfo } = s;
  const events = await Announcement.find({ public: true, type: 'event', eventDate: { $gte: new Date() } }).sort('eventDate').limit(6).select('title body eventDate').lean();
  const lm = LOGO_RE.exec(logoUrl || '');
  res.json({ schoolName, tagline, logo: lm ? `/public/logo?v=${lm[1].slice(0, 8)}` : null, address, phone, email, about, principalName, principalMessage, programs, facilities, admissionsInfo, events });
}));
publicApi.get('/news', asyncHandler(async (_req, res) => {
  res.json({ items: await Announcement.find({ public: true, type: { $in: ['news', 'notice'] } }).sort('-createdAt').limit(20).select('title body createdAt').lean() });
}));
const inquiryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many submissions. Please try again later.' } });
publicApi.post('/inquiry', inquiryLimiter, validate(z.object({
  name: z.string().min(2).max(100), phone: z.string().min(6).max(30), email: z.string().email().optional().or(z.literal('')),
  classApplying: z.string().max(50).optional(), message: z.string().max(1000).optional(),
})), asyncHandler(async (req, res) => {
  await Inquiry.create(req.body);
  res.status(201).json({ message: 'Thank you. The admissions office will contact you soon.' });
}));
export { Setting };
