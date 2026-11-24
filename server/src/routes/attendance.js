import express from "express";
import { z } from "zod";
import { Attendance, Student, Teacher, Staff } from "../models/index.js";
import { ATTENDANCE_CORRECTION_ROLES } from "../config/permissions.js";
import { asyncHandler, AppError, validate } from "../utils/errors.js";
import { requirePerm } from "../middleware/security.js";
import {
  attendanceScope,
  isTeacher,
  teacherClassIds,
} from "../utils/scopes.js";
import { audit } from "../utils/audit.js";
import { sendXlsx, sendPdfTable, schoolInfo } from "../utils/exporters.js";
import { alertAbsences, smsEnabled } from "../utils/sms.js";
import { getSettings } from "../models/index.js";

const r = express.Router();
const MODEL = { student: "Student", teacher: "Teacher", staff: "Staff" };
const PEOPLE = { student: Student, teacher: Teacher, staff: Staff };
const today = () => new Date().toISOString().slice(0, 10);

const bulkSchema = z.object({
  kind: z.enum(["student", "teacher", "staff"]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  class: z
    .string()
    .regex(/^[a-f\d]{24}$/i)
    .optional(),
  records: z
    .array(
      z.object({
        person: z.string().regex(/^[a-f\d]{24}$/i),
        status: z.enum(["present", "absent", "late", "leave"]),
        note: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

r.post(
  "/bulk",
  requirePerm("attendance", "c"),
  validate(bulkSchema),
  asyncHandler(async (req, res) => {
    const { kind, date, records, class: cls } = req.body;
    if (
      ["teacher", "staff"].includes(kind) &&
      !ATTENDANCE_CORRECTION_ROLES.includes(req.user.role)
    )
      throw new AppError(
        403,
        "Only HR or administrators can mark staff attendance",
      );
    if (date > today())
      throw new AppError(400, "Attendance cannot be marked for a future date");
    if (date < today() && !ATTENDANCE_CORRECTION_ROLES.includes(req.user.role))
      throw new AppError(
        403,
        "Correcting past attendance needs an administrator or HR manager",
      );
    if (kind === "student") {
      if (!cls) throw new AppError(400, "Choose a class");
      if (
        isTeacher(req.user) &&
        !(await teacherClassIds(req)).map(String).includes(String(cls))
      )
        throw new AppError(
          403,
          "You can only mark attendance for your own classes",
        );
      const wanted = [...new Set(records.map((x) => x.person))];
      if (
        (await Student.countDocuments({ _id: { $in: wanted }, class: cls })) !==
        wanted.length
      )
        throw new AppError(400, "Some students are not in the selected class");
    }
    const prevAbsent =
      kind === "student" && date === today() && smsEnabled()
        ? new Set(
            (
              await Attendance.find({
                kind,
                date,
                person: { $in: records.map((x) => x.person) },
                status: "absent",
              }).distinct("person")
            ).map(String),
          )
        : null;
    const ops = records.map((rec) => ({
      updateOne: {
        filter: { kind, person: rec.person, date },
        update: {
          $set: {
            status: rec.status,
            note: rec.note,
            class: cls,
            personModel: MODEL[kind],
            markedBy: req.user._id,
          },
        },
        upsert: true,
      },
    }));
    const out = await Attendance.bulkWrite(ops, { ordered: false });
    audit(req, "bulk-mark", "attendance", null, {
      kind,
      date,
      count: records.length,
    });
    if (prevAbsent && (await getSettings()).smsAbsenceAlerts)
      alertAbsences(
        records
          .filter((x) => x.status === "absent" && !prevAbsent.has(x.person))
          .map((x) => x.person),
        date,
      );
    res.json({
      saved: records.length,
      created: out.upsertedCount,
      updated: out.modifiedCount,
    });
  }),
);

// Monthly summary per person. month=YYYY-MM. Attendance % counts present + late as attended.
r.get(
  "/summary",
  requirePerm("attendance", "r"),
  asyncHandler(async (req, res) => {
    const kind = ["student", "teacher", "staff"].includes(req.query.kind)
      ? req.query.kind
      : "student";
    if (isTeacher(req.user) && kind !== "student")
      throw new AppError(403, "Not available for your role");
    const month = /^\d{4}-\d{2}$/.test(req.query.month || "")
      ? req.query.month
      : today().slice(0, 7);
    const match = {
      kind,
      date: { $regex: `^${month}-` },
      ...(await attendanceScope(req)),
    };
    if (/^[a-f\d]{24}$/i.test(req.query.class || ""))
      match.class = new (await import("mongoose")).default.Types.ObjectId(
        req.query.class,
      );
    const rows = await Attendance.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$person",
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ["$status", "leave"] }, 1, 0] } },
          total: { $sum: 1 },
        },
      },
    ]);
    const people = await PEOPLE[kind]
      .find({ _id: { $in: rows.map((x) => x._id) } })
      .select("name")
      .lean();
    const names = Object.fromEntries(
      people.map((p) => [String(p._id), p.name]),
    );
    const items = rows
      .map((x) => ({
        person: x._id,
        name: names[String(x._id)] || "Unknown",
        ...x,
        _id: undefined,
        percentage: x.total
          ? Math.round(((x.present + x.late) / x.total) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
    if (["xlsx", "pdf"].includes(req.query.format)) {
      const table = items.map((i) => ({
        Name: i.name,
        Present: i.present,
        Late: i.late,
        Absent: i.absent,
        Leave: i.leave,
        "Attendance %": i.percentage,
      }));
      const file = `attendance-${kind}-${month}`;
      return req.query.format === "xlsx"
        ? sendXlsx(res, file, "Attendance", table)
        : sendPdfTable(res, {
            filename: file,
            title: `Attendance summary ${month} (${kind})`,
            schoolName: (await schoolInfo()).schoolName,
            rows: table,
          });
    }
    res.json({ month, kind, items });
  }),
);

export default r;
