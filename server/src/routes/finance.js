import express from 'express';
import { z } from 'zod';
import { Invoice, Payment, Expense, Student, FeeStructure, nextSeq, getSettings } from '../models/index.js';
import { sendDocPdf, schoolInfo } from '../utils/exporters.js';
import { feeReminderSms, smsEnabled } from '../utils/sms.js';
import { asyncHandler, AppError, validate } from '../utils/errors.js';
import { requirePerm } from '../middleware/security.js';
import { byStudent } from '../utils/scopes.js';
import { audit } from '../utils/audit.js';
import { notify } from '../utils/notify.js';
import { User } from '../models/index.js';
import { env } from '../config/env.js';

const r = express.Router();
const oidStr = z.string().regex(/^[a-f\d]{24}$/i);
const pad = (n, w = 5) => String(n).padStart(w, '0');

const generateSchema = z.object({
  students: z.array(oidStr).max(2000).optional(),
  class: oidStr.optional(),
  feeStructures: z.array(oidStr).min(1),
  title: z.string().min(2).max(120),
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dueDate: z.string().optional(),
  discount: z.number().min(0).default(0),
  scholarship: z.number().min(0).default(0),
}).refine((b) => b.students?.length || b.class, { message: 'Choose a class or specific students' });

r.post('/generate', requirePerm('invoices', 'c'), validate(generateSchema), asyncHandler(async (req, res) => {
  const b = req.body;
  const structures = await FeeStructure.find({ _id: { $in: b.feeStructures } }).lean();
  if (!structures.length) throw new AppError(400, 'Fee structures not found');
  const students = await Student.find(b.students?.length ? { _id: { $in: b.students }, status: 'active' } : { class: b.class, status: 'active' }).select('_id').lean();
  const items = structures.map((s) => ({ name: s.name, amount: s.amount }));
  const gross = items.reduce((a, i) => a + i.amount, 0);
  const total = Math.max(0, gross - b.discount - b.scholarship);
  let created = 0; let skipped = 0;
  for (const s of students) {
    if (b.period && (await Invoice.exists({ student: s._id, period: b.period, title: b.title }))) { skipped++; continue; }
    await Invoice.create({
      number: `INV-${pad(await nextSeq('invoice'))}`, student: s._id, title: b.title, period: b.period, items,
      discount: b.discount, scholarship: b.scholarship, total, paid: 0, balance: total, status: total === 0 ? 'paid' : 'unpaid',
      dueDate: b.dueDate ? new Date(b.dueDate) : undefined,
    });
    created++;
  }
  audit(req, 'generate', 'invoices', null, { created, skipped });
  res.json({ created, skipped });
}));

// Manual payment recording (cash / bank / cheque). Safe against double-submit via idempotencyKey,
// and against over-payment via an atomic conditional update on the invoice balance.
const paySchema = z.object({
  amount: z.number().positive(), method: z.enum(['cash', 'bank', 'cheque', 'other']),
  reference: z.string().max(100).optional(), idempotencyKey: z.string().min(8).max(100),
});

r.post('/:id/payments', requirePerm('payments', 'c'), validate(paySchema), asyncHandler(async (req, res) => {
  const { amount, method, reference, idempotencyKey } = req.body;
  const prior = await Payment.findOne({ idempotencyKey }).populate('student', 'name admissionNo');
  if (prior) return res.json({ payment: prior, duplicate: true });
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) throw new AppError(404, 'Invoice not found');
  if (amount > invoice.balance + 1e-9) throw new AppError(400, `Amount exceeds the outstanding balance (${invoice.balance})`);

  let payment;
  try {
    payment = await Payment.create({ receiptNo: `RCT-${pad(await nextSeq('receipt'))}`, invoice: invoice._id, student: invoice.student, amount, method, reference, idempotencyKey, receivedBy: req.user._id });
  } catch (e) {
    if (e.code === 11000) { const dup = await Payment.findOne({ idempotencyKey }); return res.json({ payment: dup, duplicate: true }); }
    throw e;
  }
  const updated = await Invoice.findOneAndUpdate({ _id: invoice._id, balance: { $gte: amount } }, { $inc: { paid: amount, balance: -amount } }, { new: true });
  if (!updated) { await payment.deleteOne(); throw new AppError(409, 'Balance changed while processing. Reload and try again.'); }
  updated.status = updated.balance <= 0.0001 ? 'paid' : 'partial';
  await updated.save();
  audit(req, 'record-payment', 'payments', payment._id, { amount, method, invoice: invoice.number });
  const full = await Payment.findById(payment._id).populate('student', 'name admissionNo').populate('invoice', 'number title total balance');
  res.status(201).json({ payment: full, invoice: updated });
}));

r.delete('/:id', requirePerm('invoices', 'd'), asyncHandler(async (req, res) => {
  const inv = await Invoice.findById(req.params.id);
  if (!inv) throw new AppError(404, 'Invoice not found');
  if (inv.paid > 0) throw new AppError(400, 'An invoice with payments cannot be deleted');
  await inv.deleteOne(); audit(req, 'delete', 'invoices', inv._id);
  res.json({ ok: true });
}));

r.post('/remind', requirePerm('invoices', 'u'), asyncHandler(async (req, res) => {
  const overdue = await Invoice.find({ status: { $ne: 'paid' }, dueDate: { $lt: new Date() } }).select('student').lean();
  const studentIds = [...new Set(overdue.map((i) => String(i.student)))];
  const parents = await (await import('../models/index.js')).Parent.find({ children: { $in: studentIds } }).select('_id').lean();
  const users = await User.find({ role: 'parent', profileId: { $in: parents.map((p) => p._id) } }).select('_id').lean();
  const n = await notify({ userIds: users.map((u) => u._id), title: 'Fee reminder', body: 'You have overdue fees. Please check the Fees section of the parent portal.', type: 'fees', email: true });
  let sms = 0;
  if (smsEnabled() && (await getSettings()).smsFeeReminders) {
    const rows = await Invoice.aggregate([{ $match: { status: { $ne: 'paid' }, dueDate: { $lt: new Date() } } }, { $group: { _id: '$student', due: { $sum: '$balance' } } }]);
    sms = await feeReminderSms(rows);
  }
  audit(req, 'fee-reminders', 'invoices', null, { sent: n, sms });
  res.json({ notified: n, smsQueued: sms });
}));

// Gateway webhook: intentionally NOT implemented until a provider is chosen (see README).
// It never marks anything paid from an unverified request.
export const webhookRouter = express.Router();
webhookRouter.post('/', (_req, res) => {
  if (!env.gatewayWebhookSecret) return res.status(501).json({ message: 'No payment gateway is configured' });
  return res.status(501).json({ message: 'Gateway adapter not installed. Add a provider adapter that verifies the provider signature before recording payments.' });
});

export const summaryRouter = express.Router();
summaryRouter.get('/receipt/:id', requirePerm('payments', 'r'), asyncHandler(async (req, res) => {
  const p = await Payment.findOne({ $and: [{ _id: req.params.id }, await byStudent('student')(req)] }).populate('student', 'name admissionNo').populate('invoice', 'number title balance').lean();
  if (!p) throw new AppError(404, 'Receipt not found');
  sendDocPdf(res, {
    filename: p.receiptNo, info: await schoolInfo(), title: `Fee receipt ${p.receiptNo}`,
    pairs: [['Date', new Date(p.createdAt).toLocaleString()], ['Student', `${p.student?.name} (${p.student?.admissionNo})`], ['Invoice', `${p.invoice?.number} - ${p.invoice?.title}`], ['Method', p.method + (p.reference ? ` - ${p.reference}` : '')], ['Amount received', p.amount], ['Invoice balance now', p.invoice?.balance]],
  });
}));
summaryRouter.get('/summary', requirePerm('expenses', 'r'), asyncHandler(async (req, res) => {
  const from = req.query.from ? new Date(req.query.from) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const to = req.query.to ? new Date(req.query.to) : new Date();
  to.setHours(23, 59, 59, 999);
  const [inc, exp, out, byMethod] = await Promise.all([
    Payment.aggregate([{ $match: { status: 'succeeded', createdAt: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } }]),
    Expense.aggregate([{ $match: { date: { $gte: from, $lte: to } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Invoice.aggregate([{ $match: { status: { $ne: 'paid' } } }, { $group: { _id: null, total: { $sum: '$balance' }, count: { $sum: 1 } } }]),
    Payment.aggregate([{ $match: { status: 'succeeded', createdAt: { $gte: from, $lte: to } } }, { $group: { _id: '$method', total: { $sum: '$amount' } } }]),
  ]);
  const income = inc[0]?.total || 0; const expenses = exp[0]?.total || 0;
  res.json({ from, to, income, payments: inc[0]?.count || 0, expenses, net: income - expenses, outstanding: out[0]?.total || 0, unpaidInvoices: out[0]?.count || 0, byMethod });
}));

export const invoiceScope = byStudent('student');
export default r;
