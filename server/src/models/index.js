import mongoose from 'mongoose';

const { Schema } = mongoose;
const oid = (ref, extra = {}) => ({ type: Schema.Types.ObjectId, ref, ...extra });
const money = { type: Number, min: 0, default: 0 };

function mk(name, def, { indexes = [], pre } = {}) {
  const schema = new Schema(def, { timestamps: true });
  indexes.forEach(([fields, opts]) => schema.index(fields, opts));
  if (pre) schema.pre('validate', pre);
  return mongoose.models[name] || mongoose.model(name, schema);
}

const fullName = function () { if (this.firstName) this.name = `${this.firstName} ${this.lastName || ''}`.trim(); };

export const Counter = mk('Counter', { _id: String, seq: { type: Number, default: 0 } });
export async function nextSeq(key) {
  const c = await Counter.findOneAndUpdate({ _id: key }, { $inc: { seq: 1 } }, { new: true, upsert: true });
  return c.seq;
}

export const User = mk('User', {
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, required: true },
  active: { type: Boolean, default: true },
  mustChangePassword: { type: Boolean, default: false },
  phone: String,
  profileId: Schema.Types.ObjectId, // Student / Parent / Teacher / Staff record this login belongs to
  failedLogins: { type: Number, default: 0 },
  lockUntil: Date,
  tokenVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetExpires: { type: Date, select: false },
  lastLoginAt: Date,
});

export const Session = mk('Session', {
  name: { type: String, required: true, unique: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  isCurrent: { type: Boolean, default: false },
});

export const ClassModel = mk('Class', {
  name: { type: String, required: true, unique: true, trim: true },
  level: Number,
  description: String,
});

export const Section = mk('Section', {
  name: { type: String, required: true, trim: true },
  class: oid('Class', { required: true }),
  classTeacher: oid('Teacher'),
  capacity: { type: Number, min: 1, default: 40 },
  room: String,
}, { indexes: [[{ class: 1, name: 1 }, { unique: true }]] });

export const Subject = mk('Subject', {
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  classes: [oid('Class')],
  teacher: oid('Teacher'),
});

const guardian = { name: String, relation: String, phone: String, email: String };

export const Student = mk('Student', {
  admissionNo: { type: String, unique: true },
  studentCode: { type: String, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },
  name: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  dob: Date,
  photo: String,
  phone: String,
  address: String,
  guardian,
  class: oid('Class'),
  section: oid('Section'),
  session: oid('Session'),
  admissionDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['active', 'transferred', 'graduated', 'inactive'], default: 'active' },
  academicHistory: [{ session: String, className: String, section: String, result: String, date: { type: Date, default: Date.now } }],
  documents: [{ name: String, url: String }],
}, { indexes: [[{ class: 1, status: 1 }, {}], [{ name: 1 }, {}]], pre: fullName });

export const Parent = mk('Parent', {
  name: { type: String, required: true, trim: true },
  phone: String,
  email: { type: String, lowercase: true, trim: true },
  occupation: String,
  address: String,
  children: [oid('Student')],
});

const employee = {
  employeeId: { type: String, unique: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, trim: true },
  name: String,
  email: { type: String, lowercase: true, trim: true },
  phone: String,
  photo: String,
  gender: { type: String, enum: ['male', 'female', 'other'] },
  department: String,
  designation: String,
  joinDate: Date,
  status: { type: String, enum: ['active', 'on_leave', 'resigned', 'terminated'], default: 'active' },
  salary: {
    basic: money,
    allowances: [{ name: String, amount: money }],
    deductions: [{ name: String, amount: money }],
  },
  documents: [{ name: String, url: String }],
};

export const Teacher = mk('Teacher', { ...employee, subjects: [oid('Subject')], classes: [oid('Class')] }, { pre: fullName });
export const Staff = mk('Staff', employee, { pre: fullName });

export const Timetable = mk('Timetable', {
  class: oid('Class', { required: true }),
  section: oid('Section'),
  day: { type: String, enum: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], required: true },
  period: { type: Number, required: true, min: 1 },
  startTime: String,
  endTime: String,
  subject: oid('Subject', { required: true }),
  teacher: oid('Teacher'),
}, { indexes: [[{ class: 1, section: 1, day: 1, period: 1 }, { unique: true }]] });

export const Attendance = mk('Attendance', {
  kind: { type: String, enum: ['student', 'teacher', 'staff'], required: true },
  person: { type: Schema.Types.ObjectId, required: true, refPath: 'personModel' },
  personModel: { type: String, enum: ['Student', 'Teacher', 'Staff'], required: true },
  date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
  status: { type: String, enum: ['present', 'absent', 'late', 'leave'], required: true },
  class: oid('Class'),
  note: String,
  markedBy: oid('User'),
}, { indexes: [[{ kind: 1, person: 1, date: 1 }, { unique: true }], [{ date: 1, class: 1 }, {}]] });

export const FeeStructure = mk('FeeStructure', {
  name: { type: String, required: true },
  type: { type: String, enum: ['monthly', 'admission', 'exam', 'transport', 'other'], default: 'monthly' },
  class: oid('Class'),
  amount: { type: Number, required: true, min: 0 },
  description: String,
});

export const Invoice = mk('Invoice', {
  number: { type: String, unique: true },
  student: oid('Student', { required: true }),
  title: { type: String, required: true },
  period: String, // e.g. 2026-11, used to prevent duplicate monthly invoices
  items: [{ name: String, amount: money }],
  discount: money,
  scholarship: money,
  total: money,
  paid: money,
  balance: money,
  status: { type: String, enum: ['unpaid', 'partial', 'paid'], default: 'unpaid' },
  dueDate: Date,
  notes: String,
}, { indexes: [[{ student: 1, status: 1 }, {}], [{ student: 1, period: 1, title: 1 }, {}]] });

export const Payment = mk('Payment', {
  receiptNo: { type: String, unique: true },
  invoice: oid('Invoice', { required: true }),
  student: oid('Student', { required: true }),
  amount: { type: Number, required: true, min: 0.01 },
  method: { type: String, enum: ['cash', 'bank', 'cheque', 'gateway', 'other'], required: true },
  reference: String,
  idempotencyKey: { type: String, required: true, unique: true },
  status: { type: String, enum: ['succeeded', 'failed', 'refunded'], default: 'succeeded' },
  receivedBy: oid('User'),
});

export const Expense = mk('Expense', {
  title: { type: String, required: true },
  category: { type: String, default: 'general' },
  amount: { type: Number, required: true, min: 0 },
  date: { type: Date, default: Date.now },
  notes: String,
  recordedBy: oid('User'),
});

export const Payroll = mk('Payroll', {
  kind: { type: String, enum: ['teacher', 'staff'], required: true },
  person: { type: Schema.Types.ObjectId, required: true, refPath: 'personModel' },
  personModel: { type: String, enum: ['Teacher', 'Staff'], required: true },
  month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
  basic: money, allowances: money, deductions: money, absentDays: { type: Number, default: 0 },
  workingDays: { type: Number, default: 26 }, absenceDeduction: money, net: money,
  status: { type: String, enum: ['draft', 'approved', 'paid'], default: 'draft' },
  payReference: String, // bank transfer / cheque reference recorded when marked paid
  paidAt: Date,
  processedBy: oid('User'),
}, { indexes: [[{ kind: 1, person: 1, month: 1 }, { unique: true }]] });

export const Exam = mk('Exam', {
  name: { type: String, required: true },
  session: oid('Session'),
  class: oid('Class', { required: true }),
  startDate: Date,
  endDate: Date,
  subjects: [{ subject: oid('Subject', { required: true }), date: Date, maxMarks: { type: Number, default: 100, min: 1 }, passMarks: { type: Number, default: 40, min: 0 } }],
  published: { type: Boolean, default: false },
});

export const Result = mk('Result', {
  exam: oid('Exam', { required: true }),
  student: oid('Student', { required: true }),
  subject: oid('Subject', { required: true }),
  marks: { type: Number, required: true, min: 0 },
  maxMarks: { type: Number, required: true, min: 1 },
  grade: String,
  enteredBy: oid('User'),
}, { indexes: [[{ exam: 1, student: 1, subject: 1 }, { unique: true }]] });

export const Assignment = mk('Assignment', {
  title: { type: String, required: true },
  description: String,
  class: oid('Class', { required: true }),
  section: oid('Section'),
  subject: oid('Subject', { required: true }),
  dueDate: { type: Date, required: true },
  maxMarks: { type: Number, default: 100 },
  attachment: String,
  createdBy: oid('User'),
});

export const Submission = mk('Submission', {
  assignment: oid('Assignment', { required: true }),
  student: oid('Student', { required: true }),
  text: String,
  file: String,
  submittedAt: { type: Date, default: Date.now },
  late: { type: Boolean, default: false },
  marks: { type: Number, min: 0 },
  feedback: String,
  gradedBy: oid('User'),
}, { indexes: [[{ assignment: 1, student: 1 }, { unique: true }]] });

export const Announcement = mk('Announcement', {
  title: { type: String, required: true },
  body: { type: String, required: true },
  type: { type: String, enum: ['notice', 'event', 'news'], default: 'notice' },
  eventDate: Date,
  audience: [{ type: String }], // empty = everyone
  pinned: { type: Boolean, default: false },
  public: { type: Boolean, default: false }, // shown on the public website
  sendEmail: { type: Boolean, default: false },
  sendSms: { type: Boolean, default: false },
  createdBy: oid('User'),
});

export const Notification = mk('Notification', {
  user: oid('User', { required: true }),
  title: { type: String, required: true },
  body: String,
  type: { type: String, default: 'general' },
  read: { type: Boolean, default: false },
  emailStatus: { type: String, enum: ['none', 'sent', 'failed'], default: 'none' },
}, { indexes: [[{ user: 1, read: 1, createdAt: -1 }, {}]] });

export const Message = mk('Message', {
  from: oid('User', { required: true }),
  to: [oid('User')],
  subject: { type: String, required: true, trim: true, maxlength: 150 },
  body: { type: String, required: true, maxlength: 5000 },
  thread: oid('Message'), // root message of the conversation (unset on the first message)
  readBy: [oid('User')],
  deletedFor: [oid('User')],
}, { indexes: [[{ to: 1, createdAt: -1 }, {}], [{ from: 1, createdAt: -1 }, {}], [{ thread: 1, createdAt: 1 }, {}]] });

export const SmsLog = mk('SmsLog', {
  to: String, message: String, kind: String,
  status: { type: String, enum: ['sent', 'failed'] }, error: String,
}, { indexes: [[{ createdAt: -1 }, {}]] });

export const Book = mk('Book', {
  title: { type: String, required: true },
  author: String,
  publisher: String,
  category: String,
  isbn: String,
  copies: { type: Number, default: 1, min: 0 },
  available: { type: Number, default: 1, min: 0 },
});

export const BookTransaction = mk('BookTransaction', {
  book: oid('Book', { required: true }),
  borrowerModel: { type: String, enum: ['Student', 'Teacher', 'Staff'], required: true },
  borrower: { type: Schema.Types.ObjectId, required: true, refPath: 'borrowerModel' },
  issuedAt: { type: Date, default: Date.now },
  dueDate: { type: Date, required: true },
  returnedAt: Date,
  fine: money,
  issuedBy: oid('User'),
}, { indexes: [[{ returnedAt: 1, dueDate: 1 }, {}]] });

export const Vehicle = mk('Vehicle', {
  registrationNo: { type: String, required: true, unique: true },
  type: String,
  capacity: Number,
  driverName: String,
  driverPhone: String,
  driverLicense: String,
  insuranceExpiry: Date,
  status: { type: String, enum: ['active', 'maintenance', 'retired'], default: 'active' },
});

export const Route = mk('Route', {
  name: { type: String, required: true },
  stops: [String],
  vehicle: oid('Vehicle'),
  morningDeparture: String,
  afternoonDeparture: String,
  monthlyFee: money,
  students: [oid('Student')],
});

export const Leave = mk('Leave', {
  applicant: oid('User', { required: true }),
  type: { type: String, enum: ['annual', 'sick', 'casual', 'unpaid', 'other'], default: 'annual' },
  from: { type: Date, required: true },
  to: { type: Date, required: true },
  days: Number,
  reason: String,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  remark: String,
  reviewedBy: oid('User'),
});

export const Inventory = mk('Inventory', {
  name: { type: String, required: true },
  category: { type: String, enum: ['asset', 'stationery', 'equipment', 'other'], default: 'other' },
  quantity: { type: Number, default: 0, min: 0 },
  minQuantity: { type: Number, default: 0, min: 0 },
  unit: { type: String, default: 'pcs' },
  location: String,
  movements: [{ type: { type: String, enum: ['in', 'out'] }, quantity: Number, note: String, by: oid('User'), date: { type: Date, default: Date.now } }],
});

export const Inquiry = mk('Inquiry', {
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  email: String,
  classApplying: String,
  message: String,
  status: { type: String, enum: ['new', 'contacted', 'admitted', 'closed'], default: 'new' },
});

export const Setting = mk('Setting', {
  key: { type: String, default: 'school', unique: true },
  schoolName: { type: String, default: 'My School' },
  tagline: String,
  logoUrl: String,
  address: String,
  phone: String,
  email: String,
  about: String,
  principalName: String,
  principalMessage: String,
  programs: [String],
  facilities: [String],
  admissionsInfo: String,
  payrollWorkingDays: { type: Number, default: 26 },
  smsAbsenceAlerts: { type: Boolean, default: false },
  smsFeeReminders: { type: Boolean, default: false },
  gradeScale: [{ min: Number, grade: String }],
});

export const AuditLog = mk('AuditLog', {
  user: oid('User'),
  userName: String,
  action: String,
  resource: String,
  resourceId: String,
  meta: Schema.Types.Mixed,
  ip: String,
}, { indexes: [[{ createdAt: -1 }, {}]] });

export async function getSettings() {
  return (await Setting.findOne({ key: 'school' })) || Setting.create({ key: 'school' });
}
