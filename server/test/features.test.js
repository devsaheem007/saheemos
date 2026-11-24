import test from "node:test";
import assert from "node:assert/strict";
import { normalizePhone } from "../src/utils/phone.js";
import { tabulate } from "../src/utils/tabulate.js";

test("phone numbers are normalised to international format", () => {
  assert.equal(normalizePhone("03001234567"), "+923001234567");
  assert.equal(normalizePhone("+92 300 1234567"), "+923001234567");
  assert.equal(normalizePhone("923001234567"), "+923001234567");
  assert.equal(normalizePhone("3001234567"), "+923001234567");
  assert.equal(normalizePhone("0092-300-1234567"), "+923001234567");
  assert.equal(normalizePhone("+447911123456"), "+447911123456");
  assert.equal(normalizePhone("0300"), null);
  assert.equal(normalizePhone("abc"), null);
  assert.equal(normalizePhone(""), null);
  assert.equal(normalizePhone("0300", "92"), null);
});

test("export tables flatten nested and populated values and hide internals", () => {
  const t = tabulate([
    {
      _id: "x",
      __v: 0,
      name: "Ali",
      class: { _id: "c", name: "Grade 6" },
      guardian: { name: "Raza", phone: "0300" },
      tags: [{ name: "a" }, { name: "b" }],
      dob: new Date("2013-05-05"),
      passwordHash: "secret",
    },
  ]);
  assert.deepEqual(t.headers, ["Name", "Class", "Guardian", "Tags", "Dob"]);
  assert.equal(t.data[0][1], "Grade 6");
  assert.equal(t.data[0][2], "Raza");
  assert.equal(t.data[0][3], "a, b");
  assert.ok(t.data[0][4] instanceof Date);
  assert.ok(!t.headers.join().includes("Password"));
});
