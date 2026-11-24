import express from "express";
import {
  Student,
  Teacher,
  Staff,
  ClassModel,
  Attendance,
  Invoice,
  Payment,
  Exam,
  Announcement,
  AuditLog,
  Inventory,
  Assignment,
  Submission,
  Result,
  Parent,
} from "../models/index.js";
import { ADMIN_LIKE, can } from "../config/permissions.js";
import { asyncHandler, AppError } from "../utils/errors.js";
import { isPortal, isTeacher, studentIdsFor } from "../utils/scopes.js";

const r = express.Router();
const ymd = (d) => d.toISOString().slice(0, 10);

// School-wide stats. Every number is aggregated from stored records, nothing is hard-coded.
r.get(
  "/stats",
  asyncHandler(async (req, res) => {
    if (isPortal(req.user) || isTeacher(req.user)) {
      throw new AppError(403, "Use /dashboard/me");
    }

    const leadership = ADMIN_LIKE.includes(req.user.role);
    const finance = can(req.user.role, "invoices", "r");

    if (!leadership && !finance) {
      throw new AppError(403, "No dashboard for your role");
    }
    const now = new Date();
    const today = ymd(now);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sixAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
    const weekAgo = ymd(new Date(Date.now() - 6 * 86400000));

    // Non-leadership finance users receive financial figures only.
    if (!leadership) {
      const [pending, monthRev, revenue] = await Promise.all([
        Invoice.aggregate([
          { $match: { status: { $ne: "paid" } } },
          {
            $group: {
              _id: null,
              total: { $sum: "$balance" },
              count: { $sum: 1 },
            },
          },
        ]),
        Payment.aggregate([
          { $match: { status: "succeeded", createdAt: { $gte: monthStart } } },
          { $group: { _id: null, total: { $sum: "$amount" } } },
        ]),
        Payment.aggregate([
          { $match: { status: "succeeded", createdAt: { $gte: sixAgo } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
              total: { $sum: "$amount" },
            },
          },
          { $sort: { _id: 1 } },
        ]),
      ]);

      return res.json({
        counts: { students: null, teachers: null, staff: null, classes: null },
        todayAttendance: null,
        pendingFees: {
          amount: pending[0]?.total || 0,
          invoices: pending[0]?.count || 0,
        },
        monthlyRevenue: monthRev[0]?.total || 0,
        recentAdmissions: [],
        upcomingExams: [],
        announcements: [],
        lowStock: null,
        recentActivities: [],
        revenueByMonth: revenue.map((x) => ({ month: x._id, total: x.total })),
        attendanceLast7: [],
        isLeadership: false,
      });
    }

    const [
      students,
      teachers,
      staff,
      classes,
      todayAtt,
      pending,
      monthRev,
      recentAdmissions,
      exams,
      announcements,
      revenue,
      weekAtt,
      lowStock,
      activities,
    ] = await Promise.all([
      Student.countDocuments({ status: "active" }),
      Teacher.countDocuments({ status: "active" }),
      Staff.countDocuments({ status: "active" }),
      ClassModel.countDocuments(),
      Attendance.aggregate([
        { $match: { kind: "student", date: today } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      Invoice.aggregate([
        { $match: { status: { $ne: "paid" } } },
        {
          $group: {
            _id: null,
            total: { $sum: "$balance" },
            count: { $sum: 1 },
          },
        },
      ]),
      Payment.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: monthStart } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),
      Student.find()
        .sort("-createdAt")
        .limit(5)
        .select("name admissionNo createdAt")
        .populate("class", "name")
        .lean(),
      Exam.find({ startDate: { $gte: new Date(now.toDateString()) } })
        .sort("startDate")
        .limit(5)
        .populate("class", "name")
        .select("name startDate class")
        .lean(),
      Announcement.find({
        $or: [
          { type: "event", eventDate: { $gte: new Date(now.toDateString()) } },
          { pinned: true },
        ],
      })
        .sort("-pinned eventDate -createdAt")
        .limit(6)
        .select("title type eventDate pinned")
        .lean(),
      Payment.aggregate([
        { $match: { status: "succeeded", createdAt: { $gte: sixAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$createdAt" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Attendance.aggregate([
        { $match: { kind: "student", date: { $gte: weekAgo, $lte: today } } },
        {
          $group: {
            _id: "$date",
            present: {
              $sum: {
                $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0],
              },
            },
            total: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Inventory.countDocuments({
        $expr: { $lte: ["$quantity", "$minQuantity"] },
      }),
      can(req.user.role, "auditLogs", "r")
        ? AuditLog.find()
            .sort("-createdAt")
            .limit(8)
            .select("userName action resource createdAt")
            .lean()
        : [],
    ]);
    const att = Object.fromEntries(todayAtt.map((x) => [x._id, x.n]));
    res.json({
      counts: { students, teachers, staff, classes },
      todayAttendance: {
        present: att.present || 0,
        late: att.late || 0,
        absent: att.absent || 0,
        leave: att.leave || 0,
        marked: Object.values(att).reduce((a, b) => a + b, 0),
      },
      pendingFees: finance
        ? { amount: pending[0]?.total || 0, invoices: pending[0]?.count || 0 }
        : null,
      monthlyRevenue: finance ? monthRev[0]?.total || 0 : null,
      recentAdmissions,
      upcomingExams: exams,
      announcements,
      lowStock,
      recentActivities: activities,
      revenueByMonth: !finance
        ? []
        : revenue.map((x) => ({ month: x._id, total: x.total })),
      attendanceLast7: weekAtt.map((x) => ({
        date: x._id,
        percentage: x.total ? Math.round((x.present / x.total) * 100) : 0,
      })),
      isLeadership: ADMIN_LIKE.includes(req.user.role),
    });
  }),
);

// Portal / teacher home.
r.get(
  "/me",
  asyncHandler(async (req, res) => {
    if (isPortal(req.user)) {
      const ids = await studentIdsFor(req.user);
      const kids = await Student.find({ _id: { $in: ids } })
        .populate("class", "name")
        .populate("section", "name")
        .lean();
      const out = [];
      for (const k of kids) {
        const [att, fees, due, lastResult] = await Promise.all([
          Attendance.aggregate([
            { $match: { kind: "student", person: k._id } },
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                ok: {
                  $sum: {
                    $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0],
                  },
                },
              },
            },
          ]),
          Invoice.aggregate([
            { $match: { student: k._id, status: { $ne: "paid" } } },
            { $group: { _id: null, total: { $sum: "$balance" } } },
          ]),
          Assignment.countDocuments({
            class: k.class?._id,
            dueDate: { $gte: new Date() },
          }),
          Result.findOne({ student: k._id })
            .sort("-createdAt")
            .select("exam")
            .lean(),
        ]);
        out.push({
          student: {
            _id: k._id,
            name: k.name,
            admissionNo: k.admissionNo,
            class: k.class,
            section: k.section,
          },
          attendancePercentage: att[0]?.total
            ? Math.round((att[0].ok / att[0].total) * 1000) / 10
            : null,
          outstandingFees: fees[0]?.total || 0,
          assignmentsDue: due,
          hasResults: !!lastResult,
        });
      }
      return res.json({ kind: "portal", children: out });
    }
    const mine = await Assignment.find({ createdBy: req.user._id })
      .select("_id")
      .lean();
    res.json({
      kind: "staff",
      assignments: mine.length,
      submissionsToReview: await Submission.countDocuments({
        assignment: { $in: mine.map((a) => a._id) },
        marks: { $exists: false },
      }),
    });
  }),
);
export { Parent };
export default r;
