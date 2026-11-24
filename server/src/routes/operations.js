import express from 'express';
import { z } from 'zod';
import { Payroll, Teacher, Staff, Attendance, Book, BookTransaction, Inventory, Leave, User, getSettings } from '../models/index.js';
import { asyncHandler, AppError, validate } from '../utils/errors.js';
import { requirePerm } from '../middleware/security.js';
import { audit } from '../utils/audit.js';
import { notify } from '../utils/notify.js';
import { env } from '../config/env.js';
import { sendDocPdf, schoolInfo } from '../utils/exporters.js';

const oidStr = z.string().regex(/^[a-f\d]{24}$/i);
const sum = (arr = []) => arr.reduce((a, x) => a + (x.amount || 0), 0);

/* ---------------- Payroll ---------------- */
export const payroll = express.Router();

// Generates (or regenerates drafts of) payroll rows. Calculation only: nothing here moves money.
payroll.post('/generate', requirePerm('payroll', 'c'), validate(z.object({ month: z.string().regex(/^\d{4}-\d{2}$/) })), asyncHandler(async (req, res) => {
  const { month } = req.body;
  const settings = await getSettings();
  const workingDays = settings.payrollWorkingDays || 26;
  let created = 0; let skipped = 0;
  for (const [kind, Model, modelName] of [['teacher', Teacher, 'Teacher'], ['staff', Staff, 'Staff']]) {
    const people = await Model.find({ status: 'active', 'salary.basic': { $gt: 0 } }).lean();
    for (const p of people) {
      const existing = await Payroll.findOne({ kind, person: p._id, month });
      if (existing && existing.status !== 'draft') { skipped++; continue; }
      const absentDays = await Attendance.countDocuments({ kind, person: p._id, status: 'absent', date: { $regex: `^${month}-` } });
      const basic = p.salary.basic;
      const allowances = sum(p.salary.allowances); const deductions = sum(p.salary.deductions);
      const absenceDeduction = Math.round((basic / workingDays) * absentDays * 100) / 100;
      const net = Math.max(0, basic + allowances - deductions - absenceDeduction);
      await Payroll.findOneAndUpdate({ kind, person: p._id, month },
        { $set: { personModel: modelName, basic, allowances, deductions, absentDays, workingDays, absenceDeduction, net, status: 'draft', processedBy: req.user._id } }, { upsert: true });
      created++;
    }
  }
  audit(req, 'generate', 'payroll', null, { month, created, skipped });
  res.json({ created, skipped });
}));

payroll.get('/:id/payslip', requirePerm('payroll', 'r'), asyncHandler(async (req, res) => {
  const s = await Payroll.findById(req.params.id).populate('person', 'name employeeId designation').lean();
  if (!s) throw new AppError(404, 'Payroll record not found');
  sendDocPdf(res, {
    filename: `payslip-${s.month}-${s.person?.employeeId || s._id}`, info: await schoolInfo(), title: `Payslip ${s.month}`,
    pairs: [['Employee', s.person?.name], ['Employee ID', s.person?.employeeId], ['Designation', s.person?.designation]],
    table: { head: ['Item', 'Amount'], widths: [330, 160], rows: [['Basic salary', s.basic], ['Allowances', s.allowances], ['Deductions', `-${s.deductions}`], [`Absence (${s.absentDays} of ${s.workingDays} days)`, `-${s.absenceDeduction}`]], foot: ['Net pay', s.net] },
    notes: [`Status: ${s.status}${s.payReference ? ` - reference ${s.payReference}` : ''}`],
  });
}));

// draft -> approved -> paid. "paid" requires a bank/cheque reference: SaheemOS records that a transfer
// was confirmed; it does not move money itself.
payroll.post('/:id/status', requirePerm('payroll', 'u'), validate(z.object({ status: z.enum(['approved', 'paid']), reference: z.string().min(3).max(100).optional() })), asyncHandler(async (req, res) => {
  const row = await Payroll.findById(req.params.id);
  if (!row) throw new AppError(404, 'Payroll record not found');
  const { status, reference } = req.body;
  if (status === 'approved' && row.status !== 'draft') throw new AppError(400, 'Only draft payroll can be approved');
  if (status === 'paid') {
    if (row.status !== 'approved') throw new AppError(400, 'Approve payroll before marking it paid');
    if (!reference) throw new AppError(400, 'Enter the bank transfer or cheque reference that confirms payment');
    row.payReference = reference; row.paidAt = new Date();
  }
  row.status = status; await row.save();
  audit(req, `payroll-${status}`, 'payroll', row._id, { reference });
  res.json(row);
}));

/* ---------------- Library ---------------- */
export const library = express.Router();

library.post('/books/:id/issue', requirePerm('bookTransactions', 'c'), validate(z.object({
  borrowerModel: z.enum(['Student', 'Teacher', 'Staff']), borrower: oidStr, days: z.number().int().min(1).max(90).default(14),
})), asyncHandler(async (req, res) => {
  const { borrowerModel, borrower, days } = req.body;
  const book = await Book.findOneAndUpdate({ _id: req.params.id, available: { $gt: 0 } }, { $inc: { available: -1 } }, { new: true });
  if (!book) throw new AppError(409, 'No copies available for this book');
  const tx = await BookTransaction.create({ book: book._id, borrowerModel, borrower, dueDate: new Date(Date.now() + days * 86400000), issuedBy: req.user._id });
  audit(req, 'issue', 'bookTransactions', tx._id);
  res.status(201).json(tx);
}));

library.post('/transactions/:id/return', requirePerm('bookTransactions', 'u'), asyncHandler(async (req, res) => {
  const tx = await BookTransaction.findOneAndUpdate({ _id: req.params.id, returnedAt: { $exists: false } }, { returnedAt: new Date() }, { new: true });
  if (!tx) throw new AppError(409, 'This book is already returned or the record does not exist');
  const lateDays = Math.max(0, Math.ceil((tx.returnedAt - tx.dueDate) / 86400000));
  tx.fine = lateDays * env.libraryFinePerDay; await tx.save();
  await Book.updateOne({ _id: tx.book }, { $inc: { available: 1 } });
  audit(req, 'return', 'bookTransactions', tx._id, { fine: tx.fine });
  res.json(tx);
}));

/* ---------------- Inventory ---------------- */
export const inventory = express.Router();

inventory.post('/:id/movement', requirePerm('inventory', 'u'), validate(z.object({ type: z.enum(['in', 'out']), quantity: z.number().int().positive(), note: z.string().max(200).optional() })), asyncHandler(async (req, res) => {
  const { type, quantity, note } = req.body;
  const filter = type === 'out' ? { _id: req.params.id, quantity: { $gte: quantity } } : { _id: req.params.id };
  const item = await Inventory.findOneAndUpdate(filter, { $inc: { quantity: type === 'in' ? quantity : -quantity }, $push: { movements: { type, quantity, note, by: req.user._id } } }, { new: true });
  if (!item) throw new AppError(400, 'Item not found or not enough stock');
  if (item.quantity <= item.minQuantity) await notify({ roles: ['owner', 'admin'], title: `Low stock: ${item.name}`, body: `Only ${item.quantity} ${item.unit} left (minimum ${item.minQuantity}).`, type: 'inventory' });
  audit(req, `stock-${type}`, 'inventory', item._id, { quantity });
  res.json(item);
}));

/* ---------------- Leaves ---------------- */
export const leaves = express.Router();
const REVIEWERS = ['owner', 'admin', 'principal', 'vice_principal', 'hr_manager'];

leaves.post('/:id/decision', requirePerm('leaves', 'u'), validate(z.object({ status: z.enum(['approved', 'rejected']), remark: z.string().max(300).optional() })), asyncHandler(async (req, res) => {
  if (!REVIEWERS.includes(req.user.role)) throw new AppError(403, 'Only HR or administrators can approve leave');
  const leave = await Leave.findOneAndUpdate({ _id: req.params.id, status: 'pending' }, { status: req.body.status, remark: req.body.remark, reviewedBy: req.user._id }, { new: true });
  if (!leave) throw new AppError(409, 'This request was already reviewed');
  await notify({ userIds: [leave.applicant], title: `Leave ${leave.status}`, body: req.body.remark || `Your leave request was ${leave.status}.`, type: 'leave' });
  audit(req, `leave-${leave.status}`, 'leaves', leave._id);
  res.json(leave);
}));

leaves.get('/balance', asyncHandler(async (req, res) => {
  const year = new Date().getFullYear();
  const rows = await Leave.aggregate([{ $match: { applicant: req.user._id, status: 'approved', from: { $gte: new Date(year, 0, 1), $lt: new Date(year + 1, 0, 1) } } }, { $group: { _id: '$type', days: { $sum: '$days' } } }]);
  res.json({ year, used: Object.fromEntries(rows.map((x) => [x._id, x.days])) });
}));
export { User };
