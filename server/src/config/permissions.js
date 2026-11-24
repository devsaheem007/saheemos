// Single source of truth for role permissions, enforced by middleware on every API route.
// Actions: r = read, c = create, u = update, d = delete.

export const ROLES = [
  'owner', 'admin', 'principal', 'vice_principal', 'accountant', 'teacher', 'class_teacher',
  'student', 'parent', 'librarian', 'receptionist', 'transport_manager', 'hr_manager',
  'exam_controller', 'support_staff',
];

export const RESOURCES = [
  'students', 'parents', 'teachers', 'staff', 'users', 'sessions', 'classes', 'sections', 'subjects',
  'timetables', 'attendance', 'feeStructures', 'invoices', 'payments', 'expenses', 'payroll', 'exams',
  'results', 'assignments', 'submissions', 'announcements', 'books', 'bookTransactions', 'vehicles',
  'routes', 'leaves', 'inventory', 'inquiries', 'settings', 'auditLogs', 'smsLogs',
];

export const PORTAL_ROLES = ['student', 'parent'];
export const ADMIN_LIKE = ['owner', 'admin', 'principal', 'vice_principal'];
export const ATTENDANCE_CORRECTION_ROLES = [...ADMIN_LIKE, 'hr_manager'];

const ALL = 'rcud';
const academicRead = {
  students: 'r', classes: 'r', sections: 'r', subjects: 'r', sessions: 'r', timetables: 'r', exams: 'r', announcements: 'r',
};

const teacherPerms = {
  ...academicRead, teachers: 'r', attendance: 'rcu', assignments: ALL, submissions: 'ru', results: 'rcu', leaves: 'rcu', books: 'r',
};
const portalCommon = {
  ...academicRead, attendance: 'r', invoices: 'r', payments: 'r', results: 'r', assignments: 'r', books: 'r',
};
const principalPerms = { '*': 'r', announcements: ALL, leaves: 'ru', exams: 'ru', results: 'ru', inquiries: 'ru' };

const MATRIX = {
  owner: '*',
  admin: '*',
  principal: principalPerms,
  vice_principal: principalPerms,
  accountant: {
    ...academicRead, teachers: 'r', staff: 'r', feeStructures: ALL, invoices: ALL, payments: 'rc',
    expenses: ALL, payroll: 'rcu', attendance: 'r',
  },
  teacher: teacherPerms,
  class_teacher: { ...teacherPerms, students: 'ru' },
  student: { ...portalCommon, submissions: 'rcu' },
  parent: { ...portalCommon },
  librarian: { students: 'r', teachers: 'r', staff: 'r', announcements: 'r', books: ALL, bookTransactions: ALL },
  receptionist: { students: 'rc', parents: 'rc', announcements: 'r', inquiries: ALL, classes: 'r', sections: 'r' },
  transport_manager: { students: 'r', announcements: 'r', vehicles: ALL, routes: ALL },
  hr_manager: {
    teachers: ALL, staff: ALL, leaves: ALL, payroll: 'r', attendance: 'rcu', announcements: 'r', subjects: 'r', classes: 'r',
  },
  exam_controller: {
    students: 'r', classes: 'r', sections: 'r', subjects: 'r', sessions: 'r', announcements: 'r', exams: ALL, results: ALL,
  },
  support_staff: { announcements: 'r', inventory: 'rcu' },
};

export function permissionsFor(role) {
  const rule = MATRIX[role];
  const out = {};
  if (!rule) return out;
  if (rule === '*') RESOURCES.forEach((r) => { out[r] = ALL; });
  else RESOURCES.forEach((r) => { out[r] = rule[r] ?? rule['*'] ?? ''; });

  // Audit logs are append-only through the app: read-only, and only for leadership.
  out.auditLogs = ADMIN_LIKE.includes(role) ? 'r' : '';
  out.smsLogs = ADMIN_LIKE.includes(role) ? 'r' : '';
  // User accounts: owner/admin only. Settings: owner/admin edit, principals read.
  if (!['owner', 'admin'].includes(role)) out.users = '';
  if (!ADMIN_LIKE.includes(role)) out.settings = '';
  else if (!['owner', 'admin'].includes(role)) out.settings = 'r';

  Object.keys(out).forEach((k) => { if (!out[k]) delete out[k]; });
  return out;
}

export function can(role, resource, action) {
  return (permissionsFor(role)[resource] || '').includes(action);
}
