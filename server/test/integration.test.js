// Integration tests: real Express app + real MongoDB. They check permissions, parent/teacher scoping and payments.
// Run:  TEST_MONGODB_URI="mongodb://127.0.0.1:27017/saheemos_test" npm test     (the database is WIPED; its name must end in _test)
import "dotenv/config";
import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";

const URI = process.env.TEST_MONGODB_URI;
const skip = !URI
  ? "Set TEST_MONGODB_URI (database name ending in _test) to run integration tests"
  : false;

describe("API integration", { skip }, () => {
  const PW = "Testpass12345";
  let server;
  let base;
  let M;
  let mongoose;
  const id = {};
  const today = new Date().toISOString().slice(0, 10);

  const call =
    (cookie = "") =>
    async (method, path, body) => {
      const res = await fetch(`${base}/api${path}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "SaheemOS",
          ...(cookie ? { Cookie: cookie } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      let data = null;
      try {
        data = await res.json();
      } catch {
        /* empty body */
      }
      return { status: res.status, data, res };
    };
  const login = async (email, password = PW) => {
    const r = await call()("POST", "/auth/login", { email, password });
    const cookie = (r.res.headers.getSetCookie?.() || [])
      .map((c) => c.split(";")[0])
      .join("; ");
    return { ...r, as: call(cookie) };
  };

  before(async () => {
    assert.ok(
      /_test$/.test(new URL(URI).pathname.replace("/", "")),
      "TEST_MONGODB_URI database name must end in _test",
    );
    process.env.MONGODB_URI = URI;
    process.env.JWT_SECRET = "integration-test-secret-integration-test-secret";
    process.env.NODE_ENV = "test";
    mongoose = (await import("mongoose")).default;
    M = await import("../src/models/index.js");
    const { connectDb } = await import("../src/config/db.js");
    const { createApp } = await import("../src/app.js");
    const bcrypt = (await import("bcryptjs")).default;
    await connectDb();
    await mongoose.connection.dropDatabase();
    await Promise.all(
      Object.values(mongoose.models).map((m) => m.syncIndexes()),
    );

    const g6 = await M.ClassModel.create({ name: "Grade 6" });
    const g7 = await M.ClassModel.create({ name: "Grade 7" });
    id.g6 = g6._id;
    id.g7 = g7._id;
    const stu = (n, first, cls) =>
      M.Student.create({
        firstName: first,
        lastName: "T",
        class: cls,
        admissionNo: `ADM-${n}`,
        studentCode: `STU${n}`,
      });
    id.sA = (await stu(1, "Anna", g6._id))._id;
    id.sB = (await stu(2, "Ben", g6._id))._id;
    id.sC = (await stu(3, "Cara", g7._id))._id;
    const t1 = await M.Teacher.create({
      firstName: "Tina",
      employeeId: "T1",
      classes: [g6._id],
    });
    const t2 = await M.Teacher.create({
      firstName: "Tom",
      employeeId: "T2",
      classes: [g6._id],
    });
    id.parent = (await M.Parent.create({ name: "Pat", children: [id.sA] }))._id;
    const sub1 = await M.Subject.create({
      name: "Maths",
      code: "M1",
      classes: [g6._id],
      teacher: t1._id,
    });
    const sub2 = await M.Subject.create({
      name: "Art",
      code: "A1",
      classes: [g6._id],
      teacher: t2._id,
    });
    id.sub1 = sub1._id;
    id.sub2 = sub2._id;
    const subjects = [
      { subject: sub1._id, maxMarks: 100, passMarks: 40 },
      { subject: sub2._id, maxMarks: 100, passMarks: 40 },
    ];
    id.examPub = (
      await M.Exam.create({
        name: "Published",
        class: g6._id,
        published: true,
        subjects,
      })
    )._id;
    id.examDraft = (
      await M.Exam.create({
        name: "Draft",
        class: g6._id,
        published: false,
        subjects,
      })
    )._id;
    await M.Result.create({
      exam: id.examPub,
      student: id.sA,
      subject: sub1._id,
      marks: 80,
      maxMarks: 100,
      grade: "A",
    });
    await M.Result.create({
      exam: id.examDraft,
      student: id.sA,
      subject: sub1._id,
      marks: 70,
      maxMarks: 100,
      grade: "B",
    });
    const inv = (n, student) =>
      M.Invoice.create({
        number: `INV-${n}`,
        student,
        title: "Fees",
        items: [{ name: "Tuition", amount: 1000 }],
        total: 1000,
        paid: 0,
        balance: 1000,
        status: "unpaid",
      });
    id.invA = (await inv(1, id.sA))._id;
    id.invB = (await inv(2, id.sB))._id;

    const hash = await bcrypt.hash(PW, 8);
    const user = (email, role, profileId) =>
      M.User.create({
        name: email,
        email,
        role,
        profileId,
        passwordHash: hash,
      });
    await user("admin@t.test", "admin");
    await user("acct@t.test", "accountant");
    await user("teacher@t.test", "teacher", t1._id);
    await user("parent@t.test", "parent", id.parent);
    await user("student@t.test", "student", id.sA);
    await user("lock@t.test", "admin");
    server = createApp().listen(0);
    base = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    server?.close();
    await mongoose?.disconnect();
  });

  test("anonymous requests are rejected and writes need the CSRF header", async () => {
    assert.equal((await call()("GET", "/students")).status, 401);
    const raw = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    assert.equal(raw.status, 403);
  });

  test("login succeeds, fails on a wrong password, and locks after 5 failures", async () => {
    assert.equal((await login("admin@t.test")).status, 200);
    assert.equal((await login("admin@t.test", "WrongPass123")).status, 401);
    for (let i = 0; i < 5; i++) await login("lock@t.test", "WrongPass123");
    assert.equal((await login("lock@t.test")).status, 423);
  });

  test("parent sees only the linked child and cannot write", async () => {
    const { as } = await login("parent@t.test");
    const list = await as("GET", "/students");
    assert.equal(list.data.items.length, 1);
    assert.equal(list.data.items[0]._id, String(id.sA));
    assert.equal((await as("GET", `/students/${id.sB}`)).status, 404);
    const inv = await as("GET", "/invoices");
    assert.deepEqual(
      inv.data.items.map((i) => i.number),
      ["INV-1"],
    );
    assert.equal((await as("GET", `/invoices/${id.invB}`)).status, 404);
    assert.equal(
      (
        await as("POST", `/invoices/${id.invA}/payments`, {
          amount: 10,
          method: "cash",
          idempotencyKey: "parent-attempt-1",
        })
      ).status,
      403,
    );
    assert.equal(
      (await as("POST", "/students", { firstName: "X" })).status,
      403,
    );
  });

  test("students and parents only see published results of their own children", async () => {
    for (const who of ["student@t.test", "parent@t.test"]) {
      const { as } = await login(who);
      assert.equal(
        (await as("GET", `/results/report-card/${id.examDraft}/${id.sA}`))
          .status,
        403,
        `${who} draft`,
      );
      const ok = await as("GET", `/results/report-card/${id.examPub}/${id.sA}`);
      assert.equal(ok.status, 200);
      assert.equal(ok.data.total, 80);
      assert.equal(
        (await as("GET", `/results/report-card/${id.examPub}/${id.sB}`)).status,
        403,
        `${who} other child`,
      );
    }
  });

  test("teacher sees only own classes and cannot reach finance", async () => {
    const { as } = await login("teacher@t.test");
    const list = await as("GET", "/students");
    assert.deepEqual(list.data.items.map((s) => s.firstName).sort(), [
      "Anna",
      "Ben",
    ]);
    assert.equal((await as("GET", `/students/${id.sC}`)).status, 404);
    assert.equal((await as("GET", "/classes")).data.items.length, 1);
    assert.equal((await as("GET", "/invoices")).status, 403);
    assert.equal((await as("GET", "/dashboard/stats")).status, 403);
    assert.equal(
      (await as("GET", "/attendance/summary?kind=teacher")).status,
      403,
    );
  });

  test("teacher attendance and marks are limited to own classes and subjects", async () => {
    const { as } = await login("teacher@t.test");
    assert.equal(
      (
        await as("POST", "/attendance/bulk", {
          kind: "student",
          date: today,
          class: String(id.g7),
          records: [{ person: String(id.sC), status: "present" }],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await as("POST", "/attendance/bulk", {
          kind: "student",
          date: today,
          class: String(id.g6),
          records: [{ person: String(id.sC), status: "present" }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await as("POST", "/attendance/bulk", {
          kind: "student",
          date: today,
          class: String(id.g6),
          records: [{ person: String(id.sA), status: "present" }],
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await as("POST", "/results/entry", {
          exam: String(id.examDraft),
          subject: String(id.sub2),
          records: [{ student: String(id.sA), marks: 50 }],
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await as("POST", "/results/entry", {
          exam: String(id.examDraft),
          subject: String(id.sub1),
          records: [{ student: String(id.sA), marks: 150 }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await as("POST", "/results/entry", {
          exam: String(id.examDraft),
          subject: String(id.sub1),
          records: [{ student: String(id.sA), marks: 75 }],
        })
      ).status,
      200,
    );
  });

  test("payments are idempotent, cannot overpay, and update the invoice status", async () => {
    const { as } = await login("acct@t.test");
    const pay = (amount, key) =>
      as("POST", `/invoices/${id.invA}/payments`, {
        amount,
        method: "cash",
        idempotencyKey: key,
      });
    assert.equal((await pay(400, "key-0001-aaaa")).status, 201);
    const again = await pay(400, "key-0001-aaaa");
    assert.equal(again.status, 200);
    assert.equal(again.data.duplicate, true);
    assert.equal(await M.Payment.countDocuments({ invoice: id.invA }), 1);
    let inv = await M.Invoice.findById(id.invA);
    assert.equal(inv.balance, 600);
    assert.equal(inv.status, "partial");
    assert.equal((await pay(700, "key-0002-bbbb")).status, 400);
    assert.equal((await pay(600, "key-0003-cccc")).status, 201);
    inv = await M.Invoice.findById(id.invA);
    assert.equal(inv.balance, 0);
    assert.equal(inv.status, "paid");
    const { as: teacher } = await login("teacher@t.test");
    assert.equal(
      (
        await teacher("POST", `/invoices/${id.invB}/payments`, {
          amount: 10,
          method: "cash",
          idempotencyKey: "teacher-try-01",
        })
      ).status,
      403,
    );
  });

  test("public endpoints: no logo by default, inquiry is validated", async () => {
    assert.equal((await call()("GET", "/public/logo")).status, 404);
    assert.equal(
      (await call()("POST", "/public/inquiry", { name: "A" })).status,
      400,
    );
    assert.equal(
      (
        await call()("POST", "/public/inquiry", {
          name: "Parent Name",
          phone: "0300123456",
        })
      ).status,
      201,
    );
  });
  test("messaging: portal users may only write to staff, and only participants can read", async () => {
    const uid = async (email) => String((await M.User.findOne({ email }))._id);
    const [teacherId, parentId, studentId] = [
      await uid("teacher@t.test"),
      await uid("parent@t.test"),
      await uid("student@t.test"),
    ];
    const { as: student } = await login("student@t.test");
    assert.equal(
      (
        await student("POST", "/messages", {
          to: [parentId],
          subject: "Hi",
          body: "x",
        })
      ).status,
      403,
    );
    const rec = await student("GET", "/messages/recipients");
    assert.ok(
      rec.data.items.every(
        (u) => u.email === undefined && !["student", "parent"].includes(u.role),
      ),
    );
    const sent = await student("POST", "/messages", {
      to: [teacherId],
      subject: "Question",
      body: "Is homework due Monday?",
    });
    assert.equal(sent.status, 201);

    const { as: teacher } = await login("teacher@t.test");
    assert.equal(
      (await teacher("GET", "/messages/unread-count")).data.unread,
      1,
    );
    const inbox = await teacher("GET", "/messages?box=inbox");
    assert.equal(inbox.data.items.length, 1);
    assert.equal(inbox.data.items[0].unread, true);
    const open = await teacher("GET", `/messages/${sent.data._id}`);
    assert.equal(open.status, 200);
    assert.equal(open.data.thread.length, 1);
    assert.equal(
      (await teacher("GET", "/messages/unread-count")).data.unread,
      0,
    );
    const reply = await teacher("POST", "/messages", {
      to: [studentId],
      subject: "Re: Question",
      body: "Yes, Monday.",
      replyTo: sent.data._id,
    });
    assert.equal(reply.status, 201);
    assert.equal(
      (await student("GET", `/messages/${sent.data._id}`)).data.thread.length,
      2,
    );

    const { as: parent } = await login("parent@t.test");
    assert.equal(
      (await parent("GET", `/messages/${sent.data._id}`)).status,
      404,
    );
    const { as: admin } = await login("admin@t.test");
    assert.equal(
      (await admin("GET", `/messages/${sent.data._id}`)).status,
      404,
    );
    assert.equal(
      (await student("DELETE", `/messages/${sent.data._id}`)).status,
      200,
    );
    assert.equal(
      (await student("GET", `/messages/${sent.data._id}`)).status,
      404,
    );
  });
});
