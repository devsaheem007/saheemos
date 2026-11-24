import { ResourceConfig } from '../components/ResourcePage';
import { Field } from '../components/FormModal';
import { dateStr, money } from './api';
import { t } from './i18n';

const nm = (r: any) => r.name;
export const refs = {
  class: { endpoint: '/classes', label: nm },
  section: { endpoint: '/sections', label: (r: any) => `${r.class?.name || ''} – ${r.name}` },
  session: { endpoint: '/sessions', label: nm },
  subject: { endpoint: '/subjects', label: (r: any) => `${r.name} (${r.code})` },
  teacher: { endpoint: '/teachers', label: nm },
  student: { endpoint: '/students', label: (r: any) => `${r.name} (${r.admissionNo})` },
  vehicle: { endpoint: '/vehicles', label: (r: any) => r.registrationNo },
};
const GENDER = ['male', 'female', 'other'];
const badge = (v: any) => <span className="badge">{t(String(v ?? '').replace(/_/g, ' '))}</span>;

const employeeFields: Field[] = [
  { name: 'firstName', label: 'First name', required: true, half: true }, { name: 'lastName', label: 'Last name', half: true },
  { name: 'email', label: 'Email', type: 'email', half: true }, { name: 'phone', label: 'Phone', type: 'tel', half: true },
  { name: 'gender', label: 'Gender', type: 'select', options: GENDER, half: true }, { name: 'photo', label: 'Photograph', type: 'file' },
  { name: 'department', label: 'Department', half: true }, { name: 'designation', label: 'Designation', half: true },
  { name: 'joinDate', label: 'Join date', type: 'date', half: true },
  { name: 'status', label: 'Status', type: 'select', options: ['active', 'on_leave', 'resigned', 'terminated'], half: true },
  { name: 'salary.basic', label: 'Basic salary', type: 'number', half: true, hint: 'Used by payroll. Allowances and deductions can be set through the API.' },
];
const employeeCols = [
  { key: 'employeeId', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'department', label: 'Department' },
  { key: 'designation', label: 'Designation' }, { key: 'phone', label: 'Phone' }, { key: 'status', label: 'Status', render: (r: any) => badge(r.status) },
];

export const R: Record<string, ResourceConfig> = {
  students: {
    key: 'students', endpoint: '/students', title: 'Students', singular: 'Student', sub: 'Admissions, profiles and academic status',
    filters: [{ name: 'status', label: 'Status', options: ['active', 'transferred', 'graduated', 'inactive'] }],
    columns: [{ key: 'admissionNo', label: 'Admission no.' }, { key: 'name', label: 'Name' }, { key: 'class.name', label: 'Class' }, { key: 'section.name', label: 'Section' }, { key: 'guardian.name', label: 'Guardian' }, { key: 'guardian.phone', label: 'Guardian phone' }, { key: 'status', label: 'Status', render: (r) => badge(r.status) }],
    fields: [
      { name: 'firstName', label: 'First name', required: true, half: true }, { name: 'lastName', label: 'Last name', half: true },
      { name: 'gender', label: 'Gender', type: 'select', options: GENDER, half: true }, { name: 'dob', label: 'Date of birth', type: 'date', half: true },
      { name: 'class', label: 'Class', type: 'ref', ref: refs.class, half: true }, { name: 'section', label: 'Section', type: 'ref', ref: refs.section, half: true },
      { name: 'phone', label: 'Phone', type: 'tel', half: true }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'transferred', 'graduated', 'inactive'], half: true },
      { name: 'address', label: 'Address', type: 'textarea' }, { name: 'photo', label: 'Photograph', type: 'file' },
      { name: 'guardian.name', label: 'Guardian name', half: true }, { name: 'guardian.relation', label: 'Relation', half: true },
      { name: 'guardian.phone', label: 'Guardian phone', type: 'tel', half: true }, { name: 'guardian.email', label: 'Guardian email', type: 'email', half: true },
    ],
  },
  parents: {
    key: 'parents', endpoint: '/parents', title: 'Parents & guardians', singular: 'Parent', sub: 'Link parents to their children so they can use the parent portal',
    columns: [{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'children', label: 'Children' }],
    fields: [{ name: 'name', label: 'Full name', required: true, half: true }, { name: 'phone', label: 'Phone', type: 'tel', half: true }, { name: 'email', label: 'Email', type: 'email', half: true }, { name: 'occupation', label: 'Occupation', half: true }, { name: 'address', label: 'Address', type: 'textarea' }, { name: 'children', label: 'Children', type: 'multiref', ref: refs.student, hint: 'Hold Ctrl/Cmd to select several' }],
  },
  teachers: {
    key: 'teachers', endpoint: '/teachers', title: 'Teachers', singular: 'Teacher', sub: 'Teaching staff profiles, subjects and classes',
    filters: [{ name: 'status', label: 'Status', options: ['active', 'on_leave', 'resigned', 'terminated'] }],
    columns: employeeCols,
    fields: [...employeeFields, { name: 'subjects', label: 'Subjects', type: 'multiref', ref: refs.subject }, { name: 'classes', label: 'Classes', type: 'multiref', ref: refs.class }],
  },
  staff: { key: 'staff', endpoint: '/staff', title: 'Staff', singular: 'Staff member', sub: 'Non-teaching employees', columns: employeeCols, fields: employeeFields, filters: [{ name: 'status', label: 'Status', options: ['active', 'on_leave', 'resigned', 'terminated'] }] },
  sessions: {
    key: 'sessions', endpoint: '/sessions', title: 'Academic sessions', singular: 'Session', searchable: false,
    columns: [{ key: 'name', label: 'Session' }, { key: 'startDate', label: 'Starts' }, { key: 'endDate', label: 'Ends' }, { key: 'isCurrent', label: 'Current' }],
    fields: [{ name: 'name', label: 'Name (e.g. 2026-2027)', required: true }, { name: 'startDate', label: 'Start date', type: 'date', required: true, half: true }, { name: 'endDate', label: 'End date', type: 'date', required: true, half: true }, { name: 'isCurrent', label: 'This is the current session', type: 'checkbox' }],
  },
  classes: {
    key: 'classes', endpoint: '/classes', title: 'Classes', singular: 'Class',
    columns: [{ key: 'name', label: 'Class' }, { key: 'level', label: 'Level' }, { key: 'description', label: 'Description' }],
    fields: [{ name: 'name', label: 'Class name', required: true, half: true }, { name: 'level', label: 'Level (for ordering)', type: 'number', half: true }, { name: 'description', label: 'Description', type: 'textarea' }],
  },
  sections: {
    key: 'sections', endpoint: '/sections', title: 'Sections', singular: 'Section', searchable: false,
    columns: [{ key: 'class.name', label: 'Class' }, { key: 'name', label: 'Section' }, { key: 'classTeacher.name', label: 'Class teacher' }, { key: 'capacity', label: 'Capacity' }, { key: 'room', label: 'Room' }],
    fields: [{ name: 'class', label: 'Class', type: 'ref', ref: refs.class, required: true, half: true }, { name: 'name', label: 'Section name', required: true, half: true }, { name: 'classTeacher', label: 'Class teacher', type: 'ref', ref: refs.teacher, half: true }, { name: 'capacity', label: 'Capacity', type: 'number', half: true }, { name: 'room', label: 'Room', half: true }],
  },
  subjects: {
    key: 'subjects', endpoint: '/subjects', title: 'Subjects', singular: 'Subject',
    columns: [{ key: 'code', label: 'Code' }, { key: 'name', label: 'Subject' }, { key: 'classes', label: 'Classes' }, { key: 'teacher.name', label: 'Teacher' }],
    fields: [{ name: 'name', label: 'Subject name', required: true, half: true }, { name: 'code', label: 'Code', required: true, half: true }, { name: 'classes', label: 'Classes', type: 'multiref', ref: refs.class }, { name: 'teacher', label: 'Teacher', type: 'ref', ref: refs.teacher }],
  },
  timetables: {
    key: 'timetables', endpoint: '/timetables', title: 'Timetable', singular: 'Period', searchable: false, sub: 'Weekly schedule by class',
    filters: [{ name: 'day', label: 'Day', options: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }],
    columns: [{ key: 'class.name', label: 'Class' }, { key: 'section.name', label: 'Section' }, { key: 'day', label: 'Day' }, { key: 'period', label: 'Period' }, { key: 'startTime', label: 'Start' }, { key: 'endTime', label: 'End' }, { key: 'subject.name', label: 'Subject' }, { key: 'teacher.name', label: 'Teacher' }],
    fields: [{ name: 'class', label: 'Class', type: 'ref', ref: refs.class, required: true, half: true }, { name: 'section', label: 'Section', type: 'ref', ref: refs.section, half: true }, { name: 'day', label: 'Day', type: 'select', options: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'], required: true, half: true }, { name: 'period', label: 'Period number', type: 'number', required: true, half: true }, { name: 'startTime', label: 'Start (HH:MM)', half: true }, { name: 'endTime', label: 'End (HH:MM)', half: true }, { name: 'subject', label: 'Subject', type: 'ref', ref: refs.subject, required: true, half: true }, { name: 'teacher', label: 'Teacher', type: 'ref', ref: refs.teacher, half: true }],
  },
  feeStructures: {
    key: 'feeStructures', endpoint: '/fee-structures', title: 'Fee structures', singular: 'Fee', sub: 'Reusable fee items used to generate invoices',
    columns: [{ key: 'name', label: 'Fee' }, { key: 'type', label: 'Type', render: (r) => badge(r.type) }, { key: 'class.name', label: 'Class' }, { key: 'amount', label: 'Amount', render: (r) => money(r.amount) }],
    fields: [{ name: 'name', label: 'Fee name', required: true, half: true }, { name: 'type', label: 'Type', type: 'select', options: ['monthly', 'admission', 'exam', 'transport', 'other'], half: true }, { name: 'class', label: 'Class (optional)', type: 'ref', ref: refs.class, half: true }, { name: 'amount', label: 'Amount', type: 'number', required: true, half: true }, { name: 'description', label: 'Description', type: 'textarea' }],
  },
  expenses: {
    key: 'expenses', endpoint: '/expenses', title: 'Expenses', singular: 'Expense',
    columns: [{ key: 'date', label: 'Date', render: (r) => dateStr(r.date) }, { key: 'title', label: 'Title' }, { key: 'category', label: 'Category' }, { key: 'amount', label: 'Amount', render: (r) => money(r.amount) }],
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'category', label: 'Category', half: true }, { name: 'amount', label: 'Amount', type: 'number', required: true, half: true }, { name: 'date', label: 'Date', type: 'date', half: true }, { name: 'notes', label: 'Notes', type: 'textarea' }],
  },
  exams: {
    key: 'exams', endpoint: '/exams', title: 'Examinations', singular: 'Exam', sub: 'Schedule exams, then enter marks under Results',
    columns: [{ key: 'name', label: 'Exam' }, { key: 'class.name', label: 'Class' }, { key: 'startDate', label: 'Starts' }, { key: 'endDate', label: 'Ends' }, { key: 'published', label: 'Results', render: (r) => badge(r.published ? 'published' : 'draft') }],
    fields: [{ name: 'name', label: 'Exam name', required: true }, { name: 'class', label: 'Class', type: 'ref', ref: refs.class, required: true, half: true }, { name: 'session', label: 'Session', type: 'ref', ref: refs.session, half: true }, { name: 'startDate', label: 'Start date', type: 'date', half: true }, { name: 'endDate', label: 'End date', type: 'date', half: true }],
  },
  assignments: {
    key: 'assignments', endpoint: '/assignments', title: 'Assignments', singular: 'Assignment',
    columns: [{ key: 'title', label: 'Title' }, { key: 'class.name', label: 'Class' }, { key: 'subject.name', label: 'Subject' }, { key: 'dueDate', label: 'Due' }, { key: 'maxMarks', label: 'Marks' }],
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'class', label: 'Class', type: 'ref', ref: refs.class, required: true, half: true }, { name: 'subject', label: 'Subject', type: 'ref', ref: refs.subject, required: true, half: true }, { name: 'dueDate', label: 'Due date', type: 'date', required: true, half: true }, { name: 'maxMarks', label: 'Maximum marks', type: 'number', half: true }, { name: 'description', label: 'Instructions', type: 'textarea' }, { name: 'attachment', label: 'Attachment', type: 'file' }],
  },
  submissions: {
    key: 'submissions', endpoint: '/submissions', title: 'Submissions', singular: 'Submission', sub: 'Student work. Teachers grade here.',
    columns: [{ key: 'assignment.title', label: 'Assignment' }, { key: 'student.name', label: 'Student' }, { key: 'submittedAt', label: 'Submitted' }, { key: 'late', label: 'Late' }, { key: 'marks', label: 'Marks' }, { key: 'feedback', label: 'Feedback' }],
    fields: [{ name: 'marks', label: 'Marks', type: 'number', half: true }, { name: 'feedback', label: 'Feedback', type: 'textarea' }], canCreate: false,
  },
  announcements: {
    key: 'announcements', endpoint: '/announcements', title: 'Announcements', singular: 'Announcement', sub: 'Notices, events and news. Recipients are notified.',
    columns: [{ key: 'title', label: 'Title' }, { key: 'type', label: 'Type', render: (r) => badge(r.type) }, { key: 'audience', label: 'Audience', render: (r) => (r.audience?.length ? r.audience.join(', ') : 'Everyone') }, { key: 'public', label: 'On website' }, { key: 'createdAt', label: 'Posted' }],
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'body', label: 'Message', type: 'textarea', required: true }, { name: 'type', label: 'Type', type: 'select', options: ['notice', 'event', 'news'], half: true }, { name: 'eventDate', label: 'Event date', type: 'date', half: true }, { name: 'pinned', label: 'Pin to top', type: 'checkbox' }, { name: 'public', label: 'Show on the public website', type: 'checkbox' }, { name: 'sendEmail', label: 'Also send by email (needs SMTP)', type: 'checkbox' }, { name: 'sendSms', label: 'Also send by SMS (needs an SMS provider)', type: 'checkbox' }],
  },
  books: {
    key: 'books', endpoint: '/books', title: 'Library books', singular: 'Book',
    columns: [{ key: 'title', label: 'Title' }, { key: 'author', label: 'Author' }, { key: 'category', label: 'Category' }, { key: 'isbn', label: 'ISBN' }, { key: 'available', label: 'Available', render: (r) => `${r.available} / ${r.copies}` }],
    fields: [{ name: 'title', label: 'Title', required: true }, { name: 'author', label: 'Author', half: true }, { name: 'publisher', label: 'Publisher', half: true }, { name: 'category', label: 'Category', half: true }, { name: 'isbn', label: 'ISBN', half: true }, { name: 'copies', label: 'Copies', type: 'number', half: true }],
  },
  bookTransactions: {
    key: 'bookTransactions', endpoint: '/book-transactions', title: 'Loans', singular: 'Loan', canCreate: false, canEdit: false, canDelete: false, searchable: false, sub: 'Issued books, due dates and fines',
    columns: [{ key: 'book.title', label: 'Book' }, { key: 'borrower.name', label: 'Borrower' }, { key: 'issuedAt', label: 'Issued' }, { key: 'dueDate', label: 'Due', render: (r) => <span className={!r.returnedAt && new Date(r.dueDate) < new Date() ? 'font-semibold text-red-700' : ''}>{dateStr(r.dueDate)}</span> }, { key: 'returnedAt', label: 'Returned' }, { key: 'fine', label: 'Fine', render: (r) => money(r.fine) }],
    fields: [],
  },
  vehicles: {
    key: 'vehicles', endpoint: '/vehicles', title: 'Vehicles', singular: 'Vehicle',
    columns: [{ key: 'registrationNo', label: 'Registration' }, { key: 'type', label: 'Type' }, { key: 'capacity', label: 'Seats' }, { key: 'driverName', label: 'Driver' }, { key: 'driverPhone', label: 'Driver phone' }, { key: 'status', label: 'Status', render: (r) => badge(r.status) }],
    fields: [{ name: 'registrationNo', label: 'Registration no.', required: true, half: true }, { name: 'type', label: 'Type (bus, van…)', half: true }, { name: 'capacity', label: 'Seats', type: 'number', half: true }, { name: 'status', label: 'Status', type: 'select', options: ['active', 'maintenance', 'retired'], half: true }, { name: 'driverName', label: 'Driver name', half: true }, { name: 'driverPhone', label: 'Driver phone', type: 'tel', half: true }, { name: 'driverLicense', label: 'Driver licence', half: true }, { name: 'insuranceExpiry', label: 'Insurance expiry', type: 'date', half: true }],
  },
  routes: {
    key: 'routes', endpoint: '/routes', title: 'Transport routes', singular: 'Route', sub: 'Routes, schedules and student allocation',
    columns: [{ key: 'name', label: 'Route' }, { key: 'vehicle.registrationNo', label: 'Vehicle' }, { key: 'morningDeparture', label: 'Morning' }, { key: 'afternoonDeparture', label: 'Afternoon' }, { key: 'monthlyFee', label: 'Monthly fee', render: (r) => money(r.monthlyFee) }, { key: 'students', label: 'Students', render: (r) => r.students?.length || 0 }],
    fields: [{ name: 'name', label: 'Route name', required: true }, { name: 'stops', label: 'Stops (one per line)', type: 'lines' }, { name: 'vehicle', label: 'Vehicle', type: 'ref', ref: refs.vehicle, half: true }, { name: 'monthlyFee', label: 'Monthly fee', type: 'number', half: true }, { name: 'morningDeparture', label: 'Morning departure', half: true }, { name: 'afternoonDeparture', label: 'Afternoon departure', half: true }, { name: 'students', label: 'Students on this route', type: 'multiref', ref: refs.student }],
  },
  leaves: {
    key: 'leaves', endpoint: '/leaves', title: 'Leave requests', singular: 'Leave request',
    filters: [{ name: 'status', label: 'Status', options: ['pending', 'approved', 'rejected'] }], searchable: false,
    columns: [{ key: 'applicant.name', label: 'Applicant' }, { key: 'type', label: 'Type' }, { key: 'from', label: 'From' }, { key: 'to', label: 'To' }, { key: 'days', label: 'Days' }, { key: 'reason', label: 'Reason' }, { key: 'status', label: 'Status', render: (r) => badge(r.status) }],
    fields: [{ name: 'type', label: 'Type', type: 'select', options: ['annual', 'sick', 'casual', 'unpaid', 'other'], required: true }, { name: 'from', label: 'From', type: 'date', required: true, half: true }, { name: 'to', label: 'To', type: 'date', required: true, half: true }, { name: 'reason', label: 'Reason', type: 'textarea' }],
  },
  inventory: {
    key: 'inventory', endpoint: '/inventory', title: 'Inventory', singular: 'Item', sub: 'Assets, stationery and equipment',
    filters: [{ name: 'category', label: 'Category', options: ['asset', 'stationery', 'equipment', 'other'] }],
    columns: [{ key: 'name', label: 'Item' }, { key: 'category', label: 'Category' }, { key: 'quantity', label: 'In stock', render: (r) => <span className={r.quantity <= r.minQuantity ? 'font-semibold text-red-700' : ''}>{r.quantity} {r.unit}</span> }, { key: 'minQuantity', label: 'Minimum' }, { key: 'location', label: 'Location' }],
    fields: [{ name: 'name', label: 'Item name', required: true }, { name: 'category', label: 'Category', type: 'select', options: ['asset', 'stationery', 'equipment', 'other'], half: true }, { name: 'unit', label: 'Unit', half: true }, { name: 'quantity', label: 'Opening quantity', type: 'number', half: true }, { name: 'minQuantity', label: 'Low-stock alert at', type: 'number', half: true }, { name: 'location', label: 'Location', half: true }],
  },
  inquiries: {
    key: 'inquiries', endpoint: '/inquiries', title: 'Admission inquiries', singular: 'Inquiry', sub: 'Submitted from the public website', canCreate: false,
    filters: [{ name: 'status', label: 'Status', options: ['new', 'contacted', 'admitted', 'closed'] }],
    columns: [{ key: 'name', label: 'Name' }, { key: 'phone', label: 'Phone' }, { key: 'email', label: 'Email' }, { key: 'classApplying', label: 'Class' }, { key: 'message', label: 'Message' }, { key: 'status', label: 'Status', render: (r) => badge(r.status) }, { key: 'createdAt', label: 'Received' }],
    fields: [{ name: 'status', label: 'Status', type: 'select', options: ['new', 'contacted', 'admitted', 'closed'] }],
  },
  smsLogs: {
    key: 'smsLogs', endpoint: '/sms-logs', title: 'SMS log', singular: 'Entry', sub: 'Every text message the system tried to send', canCreate: false, canEdit: false, canDelete: false,
    filters: [{ name: 'status', label: 'Status', options: ['sent', 'failed'] }],
    columns: [{ key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString() }, { key: 'to', label: 'To' }, { key: 'kind', label: 'Type' }, { key: 'status', label: 'Status', render: (r) => badge(r.status) }, { key: 'message', label: 'Message' }, { key: 'error', label: 'Error' }], fields: [],
  },
  auditLogs: {
    key: 'auditLogs', endpoint: '/audit-logs', title: 'Audit log', singular: 'Entry', sub: 'Sensitive actions across the system', canCreate: false, canEdit: false, canDelete: false,
    columns: [{ key: 'createdAt', label: 'When', render: (r) => new Date(r.createdAt).toLocaleString() }, { key: 'userName', label: 'User' }, { key: 'action', label: 'Action' }, { key: 'resource', label: 'Resource' }, { key: 'ip', label: 'IP' }], fields: [],
  },
};
