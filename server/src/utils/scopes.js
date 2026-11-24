import { Parent, Student, Exam, Teacher, Section, Subject, Timetable, Assignment } from '../models/index.js';
import { PORTAL_ROLES, ADMIN_LIKE } from '../config/permissions.js';

const NONE = { _id: null };
export const isPortal = (u) => PORTAL_ROLES.includes(u.role);
export const isTeacher = (u) => ['teacher', 'class_teacher'].includes(u.role);

// Students a portal user may see: a student sees themself, a parent sees only linked children.
export async function studentIdsFor(user) {
  if (user.role === 'student') return user.profileId ? [user.profileId] : [];
  if (user.role === 'parent') {
    const p = await Parent.findById(user.profileId).select('children').lean();
    return p?.children || [];
  }
  return null; // not a portal user
}

// Classes a teacher is attached to: listed on their profile, class teacher of a section,
// teacher of a subject, or scheduled in the timetable. Cached per request.
export async function teacherClassIds(req) {
  if (req._teacherClasses) return req._teacherClasses;
  const tid = req.user.profileId;
  if (!tid) return (req._teacherClasses = []);
  const [t, bySection, bySubject, byTimetable] = await Promise.all([
    Teacher.findById(tid).select('classes').lean(),
    Section.find({ classTeacher: tid }).distinct('class'),
    Subject.find({ teacher: tid }).distinct('classes'),
    Timetable.find({ teacher: tid }).distinct('class'),
  ]);
  const map = new Map();
  [...(t?.classes || []), ...bySection, ...bySubject, ...byTimetable].forEach((id) => map.set(String(id), id));
  return (req._teacherClasses = [...map.values()]);
}

export async function teacherStudentIds(req) {
  if (req._teacherStudents) return req._teacherStudents;
  const classes = await teacherClassIds(req);
  return (req._teacherStudents = classes.length ? await Student.find({ class: { $in: classes } }).distinct('_id') : []);
}

export const studentsScope = async (req) => {
  if (isTeacher(req.user)) { const c = await teacherClassIds(req); return c.length ? { class: { $in: c } } : NONE; }
  if (!isPortal(req.user)) return {};
  return { _id: { $in: (await studentIdsFor(req.user)) || [] } };
};

export const byStudent = (field = 'student') => async (req) => {
  if (!isPortal(req.user)) return {};
  const ids = await studentIdsFor(req.user);
  return ids.length ? { [field]: { $in: ids } } : NONE;
};

export const attendanceScope = async (req) => {
  if (isTeacher(req.user)) { const ids = await teacherStudentIds(req); return ids.length ? { kind: 'student', person: { $in: ids } } : NONE; }
  if (!isPortal(req.user)) return {};
  const ids = await studentIdsFor(req.user);
  return ids.length ? { kind: 'student', person: { $in: ids } } : NONE;
};

export const resultsScope = async (req) => {
  if (isTeacher(req.user)) { const ids = await teacherStudentIds(req); return ids.length ? { student: { $in: ids } } : NONE; }
  if (!isPortal(req.user)) return {};
  const ids = await studentIdsFor(req.user);
  const published = await Exam.find({ published: true }).distinct('_id');
  return ids.length ? { student: { $in: ids }, exam: { $in: published } } : NONE;
};

export const examsScope = async (req) => {
  if (isTeacher(req.user)) { const c = await teacherClassIds(req); return c.length ? { class: { $in: c } } : NONE; }
  return isPortal(req.user) ? { published: true } : {};
};

export const classScope = (field = 'class') => async (req) => {
  if (isTeacher(req.user)) { const c = await teacherClassIds(req); return c.length ? { [field]: { $in: c } } : NONE; }
  if (!isPortal(req.user)) return {};
  const ids = await studentIdsFor(req.user);
  const classes = await Student.find({ _id: { $in: ids } }).distinct('class');
  return classes.length ? { [field]: { $in: classes } } : NONE;
};

export const subjectsScope = async (req) => {
  if (!isTeacher(req.user)) return {};
  const c = await teacherClassIds(req);
  return { $or: [{ teacher: req.user.profileId || null }, ...(c.length ? [{ classes: { $in: c } }] : [])] };
};

export const submissionsScope = async (req) => {
  if (isTeacher(req.user)) {
    const c = await teacherClassIds(req);
    const ids = c.length ? await Assignment.find({ class: { $in: c } }).distinct('_id') : [];
    return ids.length ? { assignment: { $in: ids } } : NONE;
  }
  return byStudent('student')(req);
};

export const announcementsScope = async (req) => {
  if (ADMIN_LIKE.includes(req.user.role)) return {};
  return { $or: [{ audience: { $size: 0 } }, { audience: req.user.role }] };
};

export const leavesScope = async (req) => (['owner', 'admin', 'principal', 'vice_principal', 'hr_manager'].includes(req.user.role) ? {} : { applicant: req.user._id });
