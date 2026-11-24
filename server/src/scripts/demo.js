// Loads a full set of SAMPLE data for testing every module.
//   node src/scripts/demo.js            loads sample data (stops if data already exists)
//   node src/scripts/demo.js --reset    first deletes ALL school data (keeps the owner login, settings and session), then loads
// Demo logins (all use the password printed at the end). Delete these accounts before real use.
import bcrypt from 'bcryptjs';
import { connectDb } from '../config/db.js';
import * as M from '../models/index.js';
import { gradeFor } from '../utils/grades.js';

await connectDb();
const pad = (n, w = 4) => String(n).padStart(w, '0');
const year = new Date().getFullYear();
const DAY = 86400000;
const iso = (d) => d.toISOString().slice(0, 10);
const daysFromNow = (n) => new Date(Date.now() + n * DAY);
const DEMO_PASSWORD = 'Demo12345pass';

if (process.argv.includes('--reset')) {
  const wipe = [M.ClassModel, M.Section, M.Subject, M.Teacher, M.Staff, M.Student, M.Parent, M.Timetable, M.Attendance, M.FeeStructure,
    M.Invoice, M.Payment, M.Expense, M.Payroll, M.Exam, M.Result, M.Assignment, M.Submission, M.Announcement, M.Notification, M.Book,
    M.BookTransaction, M.Vehicle, M.Route, M.Leave, M.Inventory, M.Inquiry, M.Counter, M.AuditLog];
  for (const Model of wipe) await Model.deleteMany({});
  await M.User.deleteMany({ role: { $ne: 'owner' } });
  console.log('Existing school data deleted (owner account, settings and session kept).');
}
if (await M.ClassModel.exists({}) || await M.Student.exists({})) {
  console.log('School data already exists. Nothing loaded. Use --reset to wipe and reload.');
  process.exit(0);
}

const owner = await M.User.findOne({ role: 'owner' });
let session = await M.Session.findOne({ isCurrent: true });
if (!session) session = await M.Session.create({ name: `${year}-${year + 1}`, startDate: new Date(year, 3, 1), endDate: new Date(year + 1, 2, 31), isCurrent: true });

/* ---------- School settings ---------- */
await M.Setting.updateOne({ key: 'school' }, { $set: {
  schoolName: 'Saheem Public School', tagline: 'Learning for life', address: '12 Main Boulevard, Karachi', phone: '021-1234567',
  email: 'info@saheempublic.edu', principalName: 'Mr. Imran Hashmi',
  principalMessage: 'Welcome to Saheem Public School. We believe every child can succeed when they feel safe, known and challenged.',
  about: 'Saheem Public School is a friendly, community-focused school in Karachi. We teach strong basics in English, mathematics and science, and we care just as much about discipline, kindness and confidence.',
  programs: ['Primary (Grade 1-5)', 'Middle (Grade 6-8)', 'Matric (Grade 9-10)'],
  facilities: ['Science lab', 'Library', 'Computer lab', 'Playground'],
  admissionsInfo: 'Admissions are open for Grade 1 to Grade 10.\n\n1. Submit the inquiry form or visit the office.\n2. We will contact you within 2 working days.\n3. Short assessment and meeting with the principal.\n4. Bring birth certificate, previous school certificate, 4 photos and parent CNIC copy.',
  payrollWorkingDays: 26,
} }, { upsert: true });

/* ---------- Classes, sections ---------- */
const g6 = await M.ClassModel.create({ name: 'Grade 6', level: 6 });
const g7 = await M.ClassModel.create({ name: 'Grade 7', level: 7 });
const s6a = await M.Section.create({ name: 'A', class: g6._id, capacity: 30, room: 'Room 101' });
const s6b = await M.Section.create({ name: 'B', class: g6._id, capacity: 30, room: 'Room 102' });
const s7a = await M.Section.create({ name: 'A', class: g7._id, capacity: 30, room: 'Room 201' });

/* ---------- Teachers, staff ---------- */
const mkTeacher = async (firstName, lastName, department, basic, extra = {}) => M.Teacher.create({
  firstName, lastName, department, designation: 'Teacher', gender: extra.gender, phone: extra.phone, email: extra.email, status: 'active',
  joinDate: new Date(year - 2, 7, 1), salary: { basic, allowances: [{ name: 'Transport', amount: 3000 }], deductions: [{ name: 'Provident fund', amount: 1500 }] },
  employeeId: `TCH${year}${pad(await M.nextSeq('emp-TCH'))}`,
});
const ayesha = await mkTeacher('Ayesha', 'Khan', 'Science', 50000, { gender: 'female', phone: '03211000001', email: 'ayesha@demo.school' });
const bilal = await mkTeacher('Bilal', 'Ahmed', 'Mathematics', 48000, { gender: 'male', phone: '03211000002', email: 'bilal@demo.school' });
const hina = await mkTeacher('Hina', 'Raza', 'English', 45000, { gender: 'female', phone: '03211000003', email: 'hina@demo.school' });
await M.Section.updateOne({ _id: s6a._id }, { classTeacher: ayesha._id });
await M.Section.updateOne({ _id: s6b._id }, { classTeacher: bilal._id });
await M.Section.updateOne({ _id: s7a._id }, { classTeacher: hina._id });

const mkStaff = async (firstName, lastName, department, designation, basic) => M.Staff.create({
  firstName, lastName, department, designation, status: 'active', joinDate: new Date(year - 1, 0, 15), salary: { basic },
  employeeId: `EMP${year}${pad(await M.nextSeq('emp-EMP'))}`,
});
const accountantStaff = await mkStaff('Farhan', 'Siddiqui', 'Accounts', 'Accountant', 42000);
const librarianStaff = await mkStaff('Nadia', 'Shah', 'Library', 'Librarian', 38000);
await mkStaff('Rashid', 'Ali', 'Support', 'Office assistant', 28000);

/* ---------- Subjects ---------- */
const mkSubject = (name, code, teacher) => M.Subject.create({ name, code, classes: [g6._id, g7._id], teacher: teacher._id });
const math = await mkSubject('Mathematics', 'MATH', bilal);
const sci = await mkSubject('Science', 'SCI', ayesha);
const eng = await mkSubject('English', 'ENG', hina);
await M.Teacher.updateOne({ _id: ayesha._id }, { subjects: [sci._id], classes: [g6._id, g7._id] });
await M.Teacher.updateOne({ _id: bilal._id }, { subjects: [math._id], classes: [g6._id, g7._id] });
await M.Teacher.updateOne({ _id: hina._id }, { subjects: [eng._id], classes: [g6._id, g7._id] });

/* ---------- Students & parents ---------- */
const roster = [
  ['Ali', 'Raza', 'male', g6, s6a, 'Raza Ahmed'], ['Sara', 'Malik', 'female', g6, s6a, 'Malik Iqbal'], ['Hamza', 'Siddiqui', 'male', g6, s6a, 'Siddiq Ahmed'],
  ['Maryam', 'Noor', 'female', g6, s6a, 'Noor Hassan'], ['Usman', 'Tariq', 'male', g6, s6b, 'Tariq Mehmood'], ['Hira', 'Baig', 'female', g6, s6b, 'Baig Aslam'],
  ['Omar', 'Farooq', 'male', g6, s6b, 'Farooq Khan'], ['Zara', 'Hussain', 'female', g7, s7a, 'Hussain Ali'], ['Danish', 'Qureshi', 'male', g7, s7a, 'Qureshi Javed'],
  ['Iqra', 'Anwar', 'female', g7, s7a, 'Anwar Sheikh'], ['Talha', 'Mirza', 'male', g7, s7a, 'Mirza Aziz'], ['Amna', 'Butt', 'female', g7, s7a, 'Butt Rafiq'],
];
const students = [];
for (const [i, [firstName, lastName, gender, cls, section, guardian]] of roster.entries()) {
  const n = await M.nextSeq(`student-${year}`);
  students.push(await M.Student.create({
    firstName, lastName, gender, class: cls._id, section: section._id, session: session._id, status: 'active',
    dob: new Date(2013 - (cls === g7 ? 1 : 0), i % 12, 5 + i), phone: `0300${pad(1000000 + i * 111, 7)}`, address: `House ${10 + i}, Block ${(i % 5) + 1}, Karachi`,
    guardian: { name: guardian, relation: 'Father', phone: `0301${pad(2000000 + i * 137, 7)}`, email: `parent${i + 1}@demo.school` },
    admissionNo: `ADM-${year}-${pad(n)}`, studentCode: `STU${String(year).slice(2)}${pad(n, 5)}`,
  }));
}
const g6Students = students.filter((s) => String(s.class) === String(g6._id));
const parentAli = await M.Parent.create({ name: 'Raza Ahmed', phone: '03001234567', email: 'raza@demo.school', occupation: 'Engineer', children: [students[0]._id] });
await M.Parent.create({ name: 'Malik Iqbal', phone: '03007654321', occupation: 'Shopkeeper', children: [students[1]._id] });

/* ---------- Login accounts ---------- */
const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
const mkUser = (name, email, role, profileId) => M.User.create({ name, email, role, profileId, passwordHash: hash, mustChangePassword: false });
const tUser = await mkUser('Ayesha Khan', 'ayesha@demo.school', 'class_teacher', ayesha._id);
await mkUser('Bilal Ahmed', 'bilal@demo.school', 'teacher', bilal._id);
await mkUser('Farhan Siddiqui', 'accountant@demo.school', 'accountant', accountantStaff._id);
await mkUser('Nadia Shah', 'librarian@demo.school', 'librarian', librarianStaff._id);
await mkUser('Imran Hashmi', 'principal@demo.school', 'principal');
await mkUser('Ali Raza', 'ali@demo.school', 'student', students[0]._id);
await mkUser('Raza Ahmed', 'raza@demo.school', 'parent', parentAli._id);

/* ---------- Timetable (Grade 6 A, Mon-Fri, 3 periods) ---------- */
const days = ['mon', 'tue', 'wed', 'thu', 'fri'];
const slots = [['08:00', '08:45'], ['08:45', '09:30'], ['09:45', '10:30']];
const cycle = [math, sci, eng];
const subjTeacher = { [math._id]: bilal, [sci._id]: ayesha, [eng._id]: hina };
for (const [d, day] of days.entries()) for (const [p, [startTime, endTime]] of slots.entries()) {
  const subject = cycle[(d + p) % 3];
  await M.Timetable.create({ class: g6._id, section: s6a._id, day, period: p + 1, startTime, endTime, subject: subject._id, teacher: subjTeacher[subject._id]._id });
}

/* ---------- Attendance: last 5 weekdays for Grade 6 ---------- */
const attRows = []; let back = 0; let made = 0;
while (made < 5) {
  const d = daysFromNow(-back++); if ([0, 6].includes(d.getDay())) continue; made++;
  g6Students.forEach((s, i) => {
    const k = (i + made) % 9;
    attRows.push({ kind: 'student', person: s._id, personModel: 'Student', date: iso(d), class: g6._id, markedBy: tUser._id, status: k === 0 ? 'absent' : k === 4 ? 'late' : 'present' });
  });
}
await M.Attendance.insertMany(attRows);

/* ---------- Fees: structures, invoices, payments ---------- */
const tuition = await M.FeeStructure.create({ name: 'Monthly Tuition', type: 'monthly', class: g6._id, amount: 5000 });
await M.FeeStructure.create({ name: 'Exam Fee', type: 'exam', class: g6._id, amount: 1000 });
await M.FeeStructure.create({ name: 'Admission Fee', type: 'admission', amount: 8000 });
const period = iso(new Date()).slice(0, 7);
const invoices = [];
for (const s of g6Students) {
  invoices.push(await M.Invoice.create({
    number: `INV-${pad(await M.nextSeq('invoice'), 5)}`, student: s._id, title: 'Monthly tuition', period, items: [{ name: tuition.name, amount: 5000 }],
    total: 5000, paid: 0, balance: 5000, status: 'unpaid', dueDate: daysFromNow(10),
  }));
}
const pay = async (inv, amount, method) => {
  const p = await M.Payment.create({ receiptNo: `RCT-${pad(await M.nextSeq('receipt'), 5)}`, invoice: inv._id, student: inv.student, amount, method,
    reference: method === 'bank' ? 'DEMO-TRX-1001' : undefined, idempotencyKey: `demo-${inv._id}-${amount}`, receivedBy: owner?._id });
  inv.paid += amount; inv.balance -= amount; inv.status = inv.balance <= 0 ? 'paid' : 'partial'; await inv.save(); return p;
};
await pay(invoices[0], 5000, 'cash');   // Ali: paid in full
await pay(invoices[1], 2000, 'bank');   // Sara: partial

/* ---------- Exam, marks ---------- */
const exam = await M.Exam.create({
  name: 'Mid-Term', class: g6._id, session: session._id, startDate: daysFromNow(-3), endDate: daysFromNow(1), published: true,
  subjects: [math, sci, eng].map((s, i) => ({ subject: s._id, date: daysFromNow(-3 + i), maxMarks: 100, passMarks: 40 })),
});
const scale = (await M.getSettings()).gradeScale;
const resRows = [];
g6Students.forEach((s, i) => [math, sci, eng].forEach((sub, j) => {
  const marks = 45 + ((i * 13 + j * 17) % 52);
  resRows.push({ exam: exam._id, student: s._id, subject: sub._id, marks, maxMarks: 100, grade: gradeFor(marks, 100, scale), enteredBy: tUser._id });
}));
await M.Result.insertMany(resRows);

/* ---------- Assignment & submission ---------- */
const assignment = await M.Assignment.create({ title: 'Fractions worksheet', description: 'Complete questions 1-10 from page 42.', class: g6._id, subject: math._id, dueDate: daysFromNow(7), maxMarks: 20, createdBy: tUser._id });
await M.Submission.create({ assignment: assignment._id, student: students[0]._id, text: 'Done. All answers attached on paper.', late: false });

/* ---------- Announcements ---------- */
await M.Announcement.create({ title: 'Welcome back!', body: 'We look forward to a great new term. Please check the timetable in your portal.', type: 'notice', pinned: true, createdBy: owner?._id });
await M.Announcement.create({ title: 'Annual Sports Day', body: 'Sports Day will be held on the school grounds. Parents are welcome.', type: 'event', eventDate: daysFromNow(21), public: true, createdBy: owner?._id });
await M.Announcement.create({ title: 'Admissions open', body: 'Admissions are now open for Grade 1 to Grade 10. Apply online or visit the office.', type: 'news', public: true, createdBy: owner?._id });

/* ---------- Library ---------- */
const books = await M.Book.insertMany([
  { title: 'Mathematics for Grade 6', author: 'A. Rehman', category: 'Textbook', isbn: '9780000000011', copies: 10, available: 10 },
  { title: 'Basic Science', author: 'S. Malik', category: 'Textbook', isbn: '9780000000028', copies: 8, available: 8 },
  { title: 'Tales of Wisdom', author: 'Various', category: 'Story', isbn: '9780000000035', copies: 5, available: 5 },
  { title: 'Oxford English Dictionary', author: 'Oxford', category: 'Reference', isbn: '9780000000042', copies: 2, available: 2 },
]);
await M.BookTransaction.create({ book: books[2]._id, borrowerModel: 'Student', borrower: students[2]._id, issuedAt: daysFromNow(-20), dueDate: daysFromNow(-6), issuedBy: owner?._id }); // overdue
await M.Book.updateOne({ _id: books[2]._id }, { $inc: { available: -1 } });

/* ---------- Transport ---------- */
const van = await M.Vehicle.create({ registrationNo: 'KHI-1234', type: 'Van', capacity: 14, driverName: 'Khalid Mehmood', driverPhone: '03451234567', driverLicense: 'DL-998877', insuranceExpiry: daysFromNow(200), status: 'active' });
await M.Route.create({ name: 'Gulshan Route', stops: ['Gulshan Chowrangi', 'Johar Mor', 'University Road', 'School'], vehicle: van._id, morningDeparture: '06:45', afternoonDeparture: '14:15', monthlyFee: 3000, students: [students[0]._id, students[3]._id] });

/* ---------- Inventory, expenses, leave ---------- */
await M.Inventory.insertMany([
  { name: 'A4 paper (reams)', category: 'stationery', quantity: 40, minQuantity: 10, unit: 'reams', location: 'Store room' },
  { name: 'Whiteboard markers', category: 'stationery', quantity: 6, minQuantity: 12, unit: 'pcs', location: 'Store room' }, // low stock
  { name: 'Projector', category: 'equipment', quantity: 3, minQuantity: 1, unit: 'pcs', location: 'AV room' },
]);
await M.Expense.insertMany([
  { title: 'Electricity bill', category: 'utilities', amount: 28500, date: daysFromNow(-6), recordedBy: owner?._id },
  { title: 'Lab chemicals', category: 'supplies', amount: 9200, date: daysFromNow(-4), recordedBy: owner?._id },
  { title: 'Playground repair', category: 'maintenance', amount: 15000, date: daysFromNow(-2), recordedBy: owner?._id },
]);
await M.Leave.create({ applicant: tUser._id, type: 'sick', from: daysFromNow(3), to: daysFromNow(4), days: 2, reason: 'Medical appointment', status: 'pending' });
await M.Inquiry.create({ name: 'Kamran Yousuf', phone: '03005551234', email: 'kamran@example.com', classApplying: 'Grade 3', message: 'Please share the fee structure.', status: 'new' });

console.log(`
Sample data loaded:
  2 classes, 3 sections, 3 teachers, 3 staff, 3 subjects, 12 students, 2 parents,
  15 timetable periods, 5 days of attendance, 7 invoices (1 paid, 1 partial), 1 published exam with marks,
  1 assignment, 3 announcements, 4 books, 1 vehicle/route, 3 inventory items, 3 expenses, 1 leave request, 1 inquiry.

Demo logins (password for all: ${DEMO_PASSWORD})
  ayesha@demo.school      class teacher
  bilal@demo.school       teacher
  accountant@demo.school  accountant
  librarian@demo.school   librarian
  principal@demo.school   principal
  ali@demo.school         student (Ali Raza)
  raza@demo.school        parent (sees Ali only)
Delete these demo accounts before real use.
`);
process.exit(0);
