import express from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { Message, User } from '../models/index.js';
import { PORTAL_ROLES } from '../config/permissions.js';
import { asyncHandler, AppError, validate } from '../utils/errors.js';
import { escapeRegex } from '../utils/sanitize.js';
import { notify } from '../utils/notify.js';
import { audit } from '../utils/audit.js';

const r = express.Router();
const oid = z.string().regex(/^[a-f\d]{24}$/i);
// Students and parents can only write to school staff, never to each other.
const PORTAL_CAN_WRITE_TO = ['teacher', 'class_teacher', 'principal', 'vice_principal', 'admin', 'owner', 'accountant', 'receptionist'];
const allowedRoles = (user) => (PORTAL_ROLES.includes(user.role) ? { role: { $in: PORTAL_CAN_WRITE_TO } } : {});
const visible = (me) => ({ $or: [{ from: me }, { to: me }], deletedFor: { $ne: me } });
const sendLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 40, keyGenerator: (req) => String(req.user._id), standardHeaders: true, legacyHeaders: false, validate: false, message: { message: 'You have sent too many messages. Try again later.' } });

r.get('/unread-count', asyncHandler(async (req, res) => {
  res.json({ unread: await Message.countDocuments({ to: req.user._id, readBy: { $ne: req.user._id }, deletedFor: { $ne: req.user._id } }) });
}));

r.get('/recipients', asyncHandler(async (req, res) => {
  const q = { active: true, _id: { $ne: req.user._id }, ...allowedRoles(req.user) };
  if (typeof req.query.q === 'string' && req.query.q.trim()) q.name = new RegExp(escapeRegex(req.query.q.trim().slice(0, 60)), 'i');
  res.json({ items: await User.find(q).select('name role').sort('name').limit(15).lean() }); // names only, never emails
}));

r.get('/', asyncHandler(async (req, res) => {
  const me = req.user._id; const box = req.query.box === 'sent' ? 'sent' : 'inbox';
  const page = Math.max(1, parseInt(req.query.page, 10) || 1); const limit = 20;
  const q = box === 'sent' ? { from: me, deletedFor: { $ne: me } } : { to: me, deletedFor: { $ne: me } };
  const [rows, total] = await Promise.all([
    Message.find(q).sort('-createdAt').skip((page - 1) * limit).limit(limit).populate('from', 'name role').populate('to', 'name role').lean(),
    Message.countDocuments(q),
  ]);
  res.json({
    items: rows.map((m) => ({ _id: m._id, subject: m.subject, snippet: m.body.slice(0, 120), from: m.from, to: m.to, createdAt: m.createdAt, unread: box === 'inbox' && !m.readBy.some((x) => String(x) === String(me)) })),
    total, pages: Math.max(1, Math.ceil(total / limit)),
  });
}));

r.get('/:id', asyncHandler(async (req, res) => {
  const me = req.user._id;
  const msg = await Message.findOne({ _id: req.params.id, ...visible(me) }).lean();
  if (!msg) throw new AppError(404, 'Message not found');
  const root = msg.thread || msg._id;
  const thread = await Message.find({ $and: [{ $or: [{ _id: root }, { thread: root }] }, visible(me)] }).sort('createdAt').populate('from', 'name role').populate('to', 'name role').lean();
  await Message.updateMany({ _id: { $in: thread.map((m) => m._id) }, to: me }, { $addToSet: { readBy: me } });
  res.json({ root, thread });
}));

const sendSchema = z.object({ to: z.array(oid).min(1).max(20), subject: z.string().trim().min(1).max(150), body: z.string().trim().min(1).max(5000), replyTo: oid.optional() });

r.post('/', sendLimiter, validate(sendSchema), asyncHandler(async (req, res) => {
  const me = req.user;
  const to = [...new Set(req.body.to)].filter((x) => x !== String(me._id));
  if (!to.length) throw new AppError(400, 'Choose at least one recipient other than yourself');
  const ok = await User.countDocuments({ _id: { $in: to }, active: true, ...allowedRoles(me) });
  if (ok !== to.length) throw new AppError(403, 'You cannot send a message to one of these recipients');
  let thread;
  if (req.body.replyTo) {
    const orig = await Message.findOne({ _id: req.body.replyTo, ...visible(me._id) }).select('thread').lean();
    if (!orig) throw new AppError(404, 'The message you are replying to was not found');
    thread = orig.thread || orig._id;
  }
  const msg = await Message.create({ from: me._id, to, subject: req.body.subject, body: req.body.body, thread, readBy: [me._id] });
  await notify({ userIds: to, title: `New message from ${me.name}`, body: req.body.subject, type: 'message' });
  audit(req, 'send', 'messages', msg._id, { recipients: to.length });
  res.status(201).json({ _id: msg._id });
}));

r.delete('/:id', asyncHandler(async (req, res) => {
  const out = await Message.updateOne({ _id: req.params.id, ...visible(req.user._id) }, { $addToSet: { deletedFor: req.user._id } });
  if (!out.matchedCount) throw new AppError(404, 'Message not found');
  res.json({ ok: true });
}));

export default r;
