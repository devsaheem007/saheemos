import express from "express";
import * as M from "../models/index.js";
import { crud } from "../utils/crud.js";
import { protect, requirePerm } from "../middleware/security.js";
import { AppError, asyncHandler } from "../utils/errors.js";
import { nextSeq } from "../models/index.js";
import { notify } from "../utils/notify.js";
import { PORTAL_ROLES } from "../config/permissions.js";
import * as S from "../utils/scopes.js";
import auth from "./auth.js";
import users from "./users.js";
import attendance from "./attendance.js";
import finance, { summaryRouter, webhookRouter } from "./finance.js";
import exams from "./exams.js";
import dashboard from "./dashboard.js";
import { payroll, library, inventory, leaves } from "./operations.js";
import { notifications, settings, uploads, files, publicApi } from "./misc.js";
import messages from "./messages.js";
import { announceSms } from "../utils/sms.js";

const pad = (n, w = 4) => String(n).padStart(w, "0");
const year = () => new Date().getFullYear();
const nm = (f = "name") => ({ path: f, select: "name" });

export function buildRouter() {
  const r = express.Router();

  // Public (no auth)
  r.use("/auth", auth);
  r.use("/public", publicApi);
  r.use("/payments/webhook", webhookRouter); // reachable without cookie; verified by provider signature once an adapter exists

  // Everything below needs a signed-in user
  r.use(protect);
  r.use("/users", users);
  r.use("/notifications", notifications);
  r.use("/messages", messages);
  r.use("/settings", settings);
  r.use("/uploads", uploads);
  r.use("/files", files);
  r.use("/dashboard", dashboard);
  r.use("/attendance", attendance);
  r.use("/finance", summaryRouter);
  r.use("/invoices", finance);
  r.use("/", exams); // /results/entry, /results/report-card, /results/class-summary, /exams/:id/publish
  r.use("/payroll", payroll);
  r.use("/library", library);
  r.use("/inventory", inventory);
  r.use("/leaves", leaves);

  // ----- Generic permission-enforced resources -----
  r.use(
    "/students",
    crud("students", M.Student, {
      search: ["name", "admissionNo", "studentCode", "guardian.phone"],
      filters: ["class", "section", "status"],
      populate: [nm("class"), nm("section")],
      scope: S.studentsScope,
      readonlyFields: ["admissionNo", "studentCode", "academicHistory"],
      beforeCreate: async (req, b) => {
        const n = await nextSeq(`student-${year()}`);
        const current =
          b.session ||
          (await M.Session.findOne({ isCurrent: true }).select("_id"))?._id;
        return {
          ...b,
          session: current,
          admissionNo: `ADM-${year()}-${pad(n)}`,
          studentCode: `STU${String(year()).slice(2)}${pad(n, 5)}`,
        };
      },
      // Promotion / transfer keep an academic history trail
      beforeUpdate: async (req, doc, b) => {
        if (S.isTeacher(req.user))
          for (const k of ["class", "section", "session", "status"])
            delete b[k]; // promotions/transfers are an administrator task
        if (
          (b.class && String(b.class) !== String(doc.class)) ||
          (b.status && b.status !== doc.status)
        ) {
          const cls = doc.class
            ? await M.ClassModel.findById(doc.class).select("name").lean()
            : null;
          doc.academicHistory.push({
            className: cls?.name,
            result:
              b.status && b.status !== doc.status
                ? `status: ${doc.status} → ${b.status}`
                : "promoted/moved",
          });
        }
      },
    }),
  );
  r.use(
    "/parents",
    crud("parents", M.Parent, {
      search: ["name", "phone", "email"],
      populate: [nm("children")],
    }),
  );
  const employee = (key, Model, prefix, extra = {}) =>
    crud(key, Model, {
      search: ["name", "employeeId", "email", "department"],
      filters: ["status", "department"],
      readonlyFields: ["employeeId"],
      ...extra,
      beforeCreate: async (_req, b) => ({
        ...b,
        employeeId: `${prefix}${year()}${pad(await nextSeq(`emp-${prefix}`))}`,
      }),
    });
  r.use(
    "/teachers",
    employee("teachers", M.Teacher, "TCH", {
      populate: [nm("subjects"), nm("classes")],
    }),
  );
  r.use("/staff", employee("staff", M.Staff, "EMP"));

  r.use(
    "/sessions",
    crud("sessions", M.Session, {
      sort: "-startDate",
      afterCreate: async (_req, d) => {
        if (d.isCurrent)
          await M.Session.updateMany(
            { _id: { $ne: d._id } },
            { isCurrent: false },
          );
      },
      afterUpdate: async (_req, d) => {
        if (d.isCurrent)
          await M.Session.updateMany(
            { _id: { $ne: d._id } },
            { isCurrent: false },
          );
      },
    }),
  );
  r.use(
    "/classes",
    crud("classes", M.ClassModel, {
      search: ["name"],
      sort: "level name",
      scope: S.classScope("_id"),
      beforeDelete: async (_r, d) => {
        if (await M.Student.exists({ class: d._id }))
          throw new AppError(
            400,
            "Move or remove the students in this class first",
          );
      },
    }),
  );
  r.use(
    "/sections",
    crud("sections", M.Section, {
      filters: ["class"],
      populate: [nm("class"), nm("classTeacher")],
      sort: "name",
      scope: S.classScope("class"),
    }),
  );
  r.use(
    "/subjects",
    crud("subjects", M.Subject, {
      search: ["name", "code"],
      populate: [nm("classes"), nm("teacher")],
      sort: "name",
      scope: S.subjectsScope,
    }),
  );
  r.use(
    "/timetables",
    crud("timetables", M.Timetable, {
      filters: ["class", "section", "day", "teacher"],
      populate: [nm("class"), nm("section"), nm("subject"), nm("teacher")],
      sort: "day period",
      scope: S.classScope("class"),
    }),
  );

  r.use(
    "/attendance",
    crud("attendance", M.Attendance, {
      readOnly: true,
      filters: ["kind", "date", "class", "person", "status"],
      populate: [{ path: "person", select: "name" }],
      sort: "-date",
      scope: S.attendanceScope,
    }),
  );

  r.use(
    "/fee-structures",
    crud("feeStructures", M.FeeStructure, {
      search: ["name"],
      filters: ["class", "type"],
      populate: [nm("class")],
    }),
  );
  r.use(
    "/invoices",
    crud("invoices", M.Invoice, {
      readOnly: true,
      search: ["number", "title"],
      filters: ["student", "status", "period"],
      populate: [{ path: "student", select: "name admissionNo" }],
      scope: S.byStudent("student"),
    }),
  );
  r.use(
    "/payments",
    crud("payments", M.Payment, {
      readOnly: true,
      search: ["receiptNo", "reference"],
      filters: ["student", "invoice", "method"],
      populate: [
        { path: "student", select: "name admissionNo" },
        { path: "invoice", select: "number title total balance" },
      ],
      scope: S.byStudent("student"),
    }),
  );
  r.use(
    "/expenses",
    crud("expenses", M.Expense, {
      search: ["title", "category"],
      filters: ["category"],
      sort: "-date",
      beforeCreate: (req, b) => ({ ...b, recordedBy: req.user._id }),
    }),
  );
  r.use(
    "/payroll",
    crud("payroll", M.Payroll, {
      readOnly: true,
      filters: ["month", "kind", "status"],
      populate: [{ path: "person", select: "name employeeId designation" }],
      sort: "-month",
    }),
  );

  r.use(
    "/exams",
    crud("exams", M.Exam, {
      search: ["name"],
      filters: ["class", "session", "published"],
      populate: [
        nm("class"),
        nm("session"),
        { path: "subjects.subject", select: "name code" },
      ],
      sort: "-startDate",
      scope: S.examsScope,
      readonlyFields: ["published"],
    }),
  );
  r.use(
    "/results",
    crud("results", M.Result, {
      readOnly: true,
      filters: ["exam", "student", "subject"],
      populate: [
        nm("subject"),
        { path: "exam", select: "name" },
        { path: "student", select: "name admissionNo" },
      ],
      scope: S.resultsScope,
    }),
  );

  r.use(
    "/assignments",
    crud("assignments", M.Assignment, {
      search: ["title"],
      filters: ["class", "section", "subject"],
      populate: [nm("class"), nm("subject")],
      sort: "-dueDate",
      scope: S.classScope("class"),
      beforeCreate: async (req, b) => {
        if (
          S.isTeacher(req.user) &&
          !(await S.teacherClassIds(req)).map(String).includes(String(b.class))
        )
          throw new AppError(
            403,
            "You can only create assignments for your own classes",
          );
        return { ...b, createdBy: req.user._id };
      },
      beforeUpdate: async (req, _doc, b) => {
        if (
          S.isTeacher(req.user) &&
          b.class &&
          !(await S.teacherClassIds(req)).map(String).includes(String(b.class))
        )
          throw new AppError(403, "You can only use your own classes");
      },
    }),
  );
  r.use(
    "/submissions",
    crud("submissions", M.Submission, {
      filters: ["assignment", "student"],
      populate: [
        { path: "student", select: "name admissionNo" },
        { path: "assignment", select: "title dueDate maxMarks" },
      ],
      scope: S.submissionsScope,
      readonlyFields: ["late", "submittedAt", "gradedBy"],
      beforeCreate: async (req, b) => {
        if (req.user.role !== "student")
          throw new AppError(403, "Only students submit assignments");
        const a = await M.Assignment.findById(b.assignment);
        const stu = await M.Student.findById(req.user.profileId).select(
          "class",
        );
        if (!a || !stu || String(a.class) !== String(stu.class))
          throw new AppError(403, "This assignment is not for your class");
        return {
          assignment: b.assignment,
          text: b.text,
          file: b.file,
          student: req.user.profileId,
          late: new Date() > a.dueDate,
        };
      },
      beforeUpdate: async (req, doc, b) => {
        if (PORTAL_ROLES.includes(req.user.role)) {
          if (doc.marks !== undefined && doc.marks !== null)
            throw new AppError(400, "This submission has already been graded");
          for (const k of ["marks", "feedback", "student", "assignment"])
            delete b[k];
        } else {
          for (const k of ["student", "assignment", "text", "file"])
            delete b[k];
          if (b.marks !== undefined) {
            b.gradedBy = req.user._id;
            const a = await M.Assignment.findById(doc.assignment).select(
              "maxMarks",
            );
            if (a && b.marks > a.maxMarks)
              throw new AppError(400, `Marks cannot exceed ${a.maxMarks}`);
          }
        }
      },
      afterUpdate: async () => {},
    }),
  );
  r.use(
    "/announcements",
    crud("announcements", M.Announcement, {
      search: ["title", "body"],
      filters: ["type"],
      sort: "-pinned -createdAt",
      scope: S.announcementsScope,
      beforeCreate: (req, b) => ({ ...b, createdBy: req.user._id }),
      afterCreate: async (_req, d) => {
        await notify({
          roles: d.audience,
          title: d.title,
          body: d.body.slice(0, 300),
          type: "announcement",
          email: d.sendEmail,
        });
        if (d.sendSms) await announceSms(d);
      },
    }),
  );

  r.use(
    "/books",
    crud("books", M.Book, {
      search: ["title", "author", "isbn", "category"],
      filters: ["category"],
      readonlyFields: ["available"],
      beforeCreate: (_r, b) => ({ ...b, available: b.copies ?? 1 }),
      beforeUpdate: async (_r, doc, b) => {
        if (b.copies !== undefined) {
          const issued = doc.copies - doc.available;
          if (b.copies < issued)
            throw new AppError(400, `${issued} copies are currently issued`);
          doc.available = b.copies - issued;
        }
      },
    }),
  );
  r.use(
    "/book-transactions",
    crud("bookTransactions", M.BookTransaction, {
      readOnly: true,
      filters: ["book", "borrower"],
      populate: [
        { path: "book", select: "title" },
        { path: "borrower", select: "name" },
      ],
      sort: "-issuedAt",
    }),
  );
  r.use(
    "/vehicles",
    crud("vehicles", M.Vehicle, {
      search: ["registrationNo", "driverName"],
      filters: ["status"],
    }),
  );
  r.use(
    "/routes",
    crud("routes", M.Route, {
      search: ["name"],
      populate: [{ path: "vehicle", select: "registrationNo" }, nm("students")],
    }),
  );
  r.use(
    "/leaves",
    crud("leaves", M.Leave, {
      filters: ["status", "type"],
      populate: [{ path: "applicant", select: "name role" }],
      scope: S.leavesScope,
      readonlyFields: ["status", "reviewedBy", "applicant", "remark", "days"],
      sort: "-createdAt",
      beforeCreate: (req, b) => {
        const from = new Date(b.from);
        const to = new Date(b.to);
        if (!(to >= from))
          throw new AppError(
            400,
            "End date must be on or after the start date",
          );
        return {
          ...b,
          applicant: req.user._id,
          status: "pending",
          days: Math.round((to - from) / 86400000) + 1,
        };
      },
      beforeUpdate: (_r, doc) => {
        if (doc.status !== "pending")
          throw new AppError(400, "Reviewed requests cannot be edited");
      },
    }),
  );
  r.use(
    "/inventory",
    crud("inventory", M.Inventory, {
      search: ["name", "category"],
      filters: ["category"],
      readonlyFields: ["movements"],
    }),
  );
  r.use(
    "/inquiries",
    crud("inquiries", M.Inquiry, {
      search: ["name", "phone", "email"],
      filters: ["status"],
    }),
  );
  r.use(
    "/sms-logs",
    crud("smsLogs", M.SmsLog, {
      readOnly: true,
      search: ["to", "message", "kind"],
      filters: ["status", "kind"],
    }),
  );
  r.use(
    "/audit-logs",
    crud("auditLogs", M.AuditLog, {
      readOnly: true,
      search: ["userName", "action", "resource"],
      filters: ["resource", "action"],
    }),
  );

  // Link a student to a parent (parents can then see them in the portal)

  // Link a valid existing student to a parent.
  r.post(
    "/parents/:id/link",
    requirePerm("parents", "u"),
    asyncHandler(async (req, res) => {
      const { id } = req.params;
      const studentId = req.body?.student;

      if (!/^[a-f\d]{24}$/i.test(id)) {
        throw new AppError(400, "Invalid parent ID");
      }

      if (typeof studentId !== "string" || !/^[a-f\d]{24}$/i.test(studentId)) {
        throw new AppError(400, "Invalid student ID");
      }

      const parent = await M.Parent.findById(id);
      if (!parent) throw new AppError(404, "Parent not found");

      const studentExists = await M.Student.exists({ _id: studentId });
      if (!studentExists) throw new AppError(404, "Student not found");

      parent.children.addToSet(studentId);
      await parent.save();

      res.json(parent);
    }),
  );
  return r;
}
