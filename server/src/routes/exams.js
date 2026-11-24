import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Exam, Result, Student, Subject, getSettings } from '../models/index.js';
import { ADMIN_LIKE } from '../config/permissions.js';
import { asyncHandler, AppError, validate } from '../utils/errors.js';
import { requirePerm } from '../middleware/security.js';
import { gradeFor, percent } from '../utils/grades.js';
import { studentIdsFor, isPortal, isTeacher, teacherClassIds } from '../utils/scopes.js';
import { audit } from '../utils/audit.js';
import { notify } from '../utils/notify.js';
import { sendDocPdf, sendXlsx, sendPdfTable, schoolInfo } from '../utils/exporters.js';

const r = express.Router();
const oidStr = z.string().regex(/^[a-f\d]{24}$/i);

const entrySchema = z.object({
  exam: oidStr, subject: oidStr,
  records: z.array(z.object({ student: oidStr, marks: z.number().min(0) })).min(1).max(1000),
});

r.post('/results/entry', requirePerm('results', 'c'), validate(entrySchema), asyncHandler(async (req, res) => {
  const { exam: examId, subject, records } = req.body;
  const exam = await Exam.findById(examId);
  if (!exam) throw new AppError(404, 'Exam not found');
  if (exam.published && !ADMIN_LIKE.includes(req.user.role)) throw new AppError(403, 'Results are published and locked. Ask an administrator to unpublish them first.');
  const entry = exam.subjects.find((s) => String(s.subject) === subject);
  if (!entry) throw new AppError(400, 'That subject is not part of this exam');
  const wanted = [...new Set(records.map((x) => x.student))];
  if ((await Student.countDocuments({ _id: { $in: wanted }, class: exam.class })) !== wanted.length) throw new AppError(400, 'Some students are not in this exam\'s class');
  if (isTeacher(req.user)) {
    if (!(await teacherClassIds(req)).map(String).includes(String(exam.class))) throw new AppError(403, 'You can only enter marks for your own classes');
    if (req.user.role === 'teacher' && !(await Subject.exists({ _id: subject, teacher: req.user.profileId }))) throw new AppError(403, 'You can only enter marks for subjects you teach');
  }
  const bad = records.find((x) => x.marks > entry.maxMarks);
  if (bad) throw new AppError(400, `Marks cannot exceed ${entry.maxMarks}`);
  const scale = (await getSettings()).gradeScale;
  await Result.bulkWrite(records.map((x) => ({
    updateOne: {
      filter: { exam: examId, student: x.student, subject },
      update: { $set: { marks: x.marks, maxMarks: entry.maxMarks, grade: gradeFor(x.marks, entry.maxMarks, scale), enteredBy: req.user._id } },
      upsert: true,
    },
  })), { ordered: false });
  audit(req, 'enter-marks', 'results', null, { exam: examId, subject, count: records.length });
  res.json({ saved: records.length });
}));

r.post('/exams/:id/publish', requirePerm('exams', 'u'), validate(z.object({ published: z.boolean() })), asyncHandler(async (req, res) => {
  const exam = await Exam.findByIdAndUpdate(req.params.id, { published: req.body.published }, { new: true });
  if (!exam) throw new AppError(404, 'Exam not found');
  audit(req, req.body.published ? 'publish' : 'unpublish', 'exams', exam._id);
  if (req.body.published) await notify({ roles: ['student', 'parent'], title: `Results published: ${exam.name}`, body: 'You can view results and download the report card in your portal.', type: 'exam' });
  res.json(exam);
}));

r.get('/results/report-card/:examId/:studentId', requirePerm('results', 'r'), asyncHandler(async (req, res) => {
  const { examId, studentId } = req.params;
  if (isPortal(req.user)) {
    const ids = (await studentIdsFor(req.user)).map(String);
    if (!ids.includes(studentId)) throw new AppError(403, 'You can only view your own results');
  }
  const exam = await Exam.findById(examId).populate('class', 'name').lean();
  if (!exam) throw new AppError(404, 'Exam not found');
  if (isPortal(req.user) && !exam.published) throw new AppError(403, 'Results have not been published yet');
  const student = await Student.findById(studentId).populate('class', 'name').populate('section', 'name').lean();
  if (!student) throw new AppError(404, 'Student not found');
  if (isTeacher(req.user) && !(await teacherClassIds(req)).map(String).includes(String(student.class?._id))) throw new AppError(403, 'This student is not in your classes');
  const rows = await Result.find({ exam: examId, student: studentId }).populate('subject', 'name code').lean();
  const total = rows.reduce((a, x) => a + x.marks, 0);
  const max = rows.reduce((a, x) => a + x.maxMarks, 0);
  const scale = (await getSettings()).gradeScale;
  const passMarks = Object.fromEntries(exam.subjects.map((s) => [String(s.subject), s.passMarks]));
  const payload = {
    exam: { _id: exam._id, name: exam.name, class: exam.class, published: exam.published }, student,
    subjects: rows.map((x) => ({ name: x.subject?.name, code: x.subject?.code, marks: x.marks, max: x.maxMarks, grade: x.grade, passed: x.marks >= (passMarks[String(x.subject?._id)] ?? 0) })),
    total, max, percentage: percent(total, max), grade: gradeFor(total, max, scale),
    passed: rows.length > 0 && rows.every((x) => x.marks >= (passMarks[String(x.subject?._id)] ?? 0)),
  };
  if (req.query.format === 'pdf') {
    return sendDocPdf(res, {
      filename: `report-card-${student.admissionNo}`, info: await schoolInfo(), title: `Report card - ${exam.name}`,
      pairs: [['Student', student.name], ['Admission no.', student.admissionNo], ['Class', `${student.class?.name || ''} ${student.section?.name || ''}`.trim()]],
      table: { head: ['Subject', 'Marks', 'Out of', 'Grade'], rows: payload.subjects.map((s) => [s.name, s.marks, s.max, s.grade]), foot: ['Total', payload.total, payload.max, payload.grade] },
      notes: [`Percentage: ${payload.percentage}%`, `Result: ${payload.passed ? 'Pass' : 'Needs improvement'}`],
    });
  }
  res.json(payload);
}));

// Class-wise result sheet: totals per student for an exam.
r.get('/results/class-summary', requirePerm('results', 'r'), asyncHandler(async (req, res) => {
  if (isPortal(req.user)) throw new AppError(403, 'Not available');
  if (!/^[a-f\d]{24}$/i.test(req.query.exam || '')) throw new AppError(400, 'exam is required');
  if (isTeacher(req.user)) {
    const ex = await Exam.findById(req.query.exam).select('class').lean();
    if (!ex || !(await teacherClassIds(req)).map(String).includes(String(ex.class))) throw new AppError(403, 'This exam is not for your classes');
  }
  const rows = await Result.aggregate([
    { $match: { exam: new mongoose.Types.ObjectId(req.query.exam) } },
    { $group: { _id: '$student', total: { $sum: '$marks' }, max: { $sum: '$maxMarks' }, subjects: { $sum: 1 } } },
  ]);
  const students = await Student.find({ _id: { $in: rows.map((x) => x._id) } }).select('name admissionNo').lean();
  const info = Object.fromEntries(students.map((s) => [String(s._id), s]));
  const scale = (await getSettings()).gradeScale;
  const items = rows.map((x) => ({ student: info[String(x._id)], total: x.total, max: x.max, subjects: x.subjects, percentage: percent(x.total, x.max), grade: gradeFor(x.total, x.max, scale) }))
    .sort((a, b) => b.percentage - a.percentage).map((x, i) => ({ ...x, rank: i + 1 }));
  if (['xlsx', 'pdf'].includes(req.query.format)) {
    const table = items.map((x) => ({ Rank: x.rank, Student: x.student?.name, 'Admission no.': x.student?.admissionNo, Total: x.total, 'Out of': x.max, 'Percentage': x.percentage, Grade: x.grade }));
    return req.query.format === 'xlsx' ? sendXlsx(res, 'class-results', 'Results', table) : sendPdfTable(res, { filename: 'class-results', title: 'Class results', schoolName: (await schoolInfo()).schoolName, rows: table });
  }
  res.json({ items });
}));

export default r;
