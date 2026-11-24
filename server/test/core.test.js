import test from "node:test";
import assert from "node:assert/strict";
import {
  can,
  permissionsFor,
  ROLES,
  RESOURCES,
} from "../src/config/permissions.js";
import { gradeFor, percent } from "../src/utils/grades.js";
import { sanitize, escapeRegex } from "../src/utils/sanitize.js";
import { toCsv } from "../src/utils/csv.js";

test("every role resolves to a permissions object", () => {
  for (const r of ROLES) assert.equal(typeof permissionsFor(r), "object");
});

test("owner and admin can do everything except edit audit logs", () => {
  for (const role of ["owner", "admin"]) {
    for (const res of RESOURCES.filter(
      (x) => !["auditLogs", "smsLogs"].includes(x),
    ))
      for (const a of "rcud")
        assert.ok(can(role, res, a), `${role} ${res} ${a}`);
    assert.ok(can(role, "auditLogs", "r"));
    assert.ok(!can(role, "auditLogs", "d"));
  }
});

test("students and parents are read-only on money and results", () => {
  for (const role of ["student", "parent"]) {
    assert.ok(can(role, "invoices", "r"));
    assert.ok(!can(role, "invoices", "c"));
    assert.ok(!can(role, "payments", "c"));
    assert.ok(!can(role, "results", "c"));
    assert.ok(!can(role, "users", "r"));
    assert.ok(!can(role, "students", "u"));
  }
  assert.ok(can("student", "submissions", "c"));
  assert.ok(!can("parent", "submissions", "c"));
});

test("role boundaries", () => {
  assert.ok(can("accountant", "payments", "c"));
  assert.ok(!can("accountant", "payments", "d"));
  assert.ok(!can("accountant", "results", "c"));
  assert.ok(can("teacher", "attendance", "c"));
  assert.ok(!can("teacher", "invoices", "r"));
  assert.ok(!can("teacher", "users", "r"));
  assert.ok(can("librarian", "books", "d"));
  assert.ok(!can("librarian", "students", "u"));
  assert.ok(!can("principal", "users", "c"));
  assert.ok(can("principal", "students", "r"));
  assert.ok(!can("principal", "students", "d"));
  assert.ok(!can("support_staff", "students", "r"));
  assert.ok(!can("hr_manager", "invoices", "r"));
  assert.ok(!can("nobody", "students", "r"));
});

test("grades follow the scale and handle edge cases", () => {
  assert.equal(gradeFor(95, 100), "A+");
  assert.equal(gradeFor(80, 100), "A");
  assert.equal(gradeFor(39, 100), "F");
  assert.equal(gradeFor(45, 50), "A+");
  assert.equal(gradeFor(10, 0), "N/A");
  assert.equal(
    gradeFor(70, 100, [
      { min: 50, grade: "Pass" },
      { min: 0, grade: "Fail" },
    ]),
    "Pass",
  );
  assert.equal(percent(45, 60), 75);
  assert.equal(percent(1, 0), 0);
});

test("sanitize strips operator and dotted keys, deeply", () => {
  const out = sanitize({
    email: { $gt: "" },
    ok: 1,
    "a.b": 2,
    nested: [{ $where: "x", keep: true }],
  });
  assert.deepEqual(out, { email: {}, ok: 1, nested: [{ keep: true }] });
  assert.equal(new RegExp(escapeRegex("a.*b(")).test("a.*b("), true);
});

test("csv export escapes quotes and neutralises formulas", () => {
  const csv = toCsv([{ name: 'Ali, "A"', note: '=HYPERLINK("x")', n: 3 }]);
  assert.match(csv, /"Ali, ""A"""/);
  assert.match(csv, /'=HYPERLINK/);
});
