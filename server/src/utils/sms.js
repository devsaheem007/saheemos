import { env } from '../config/env.js';
import { SmsLog, Student, Parent, User, getSettings } from '../models/index.js';
import { normalizePhone } from './phone.js';

export const smsEnabled = () => {
  const s = env.sms;
  if (s.provider === 'twilio') return !!(s.twilio.sid && s.twilio.token && s.twilio.from);
  if (s.provider === 'http') return !!s.http.url;
  return false;
};

const record = (to, message, kind, status, error) => SmsLog.create({ to, message, kind, status, error }).catch(() => {});

// Never throws. Returns { sent, error? } and writes an SMS log row for every attempt.
export async function sendSms({ to, message, kind = 'general' }) {
  if (!smsEnabled()) return { sent: false, error: 'SMS is not configured' };
  const phone = normalizePhone(to, env.sms.countryCode);
  const text = String(message || '').slice(0, 320);
  if (!phone) { await record(String(to), text, kind, 'failed', 'Invalid phone number'); return { sent: false, error: 'Invalid phone number' }; }
  try {
    if (env.sms.provider === 'twilio') {
      const { sid, token, from } = env.sms.twilio;
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ To: phone, From: from, Body: text }),
      });
      if (!res.ok) throw new Error(`Twilio ${res.status}: ${(await res.text()).slice(0, 160)}`);
    } else {
      // Generic HTTP gateway: {to} and {message} are replaced in the URL and the optional body.
      const h = env.sms.http; const method = h.method.toUpperCase();
      const url = h.url.replaceAll('{to}', encodeURIComponent(phone)).replaceAll('{message}', encodeURIComponent(text));
      const headers = h.headers ? JSON.parse(h.headers) : {};
      const opts = { method, headers };
      if (method !== 'GET' && h.body) {
        opts.body = h.body.replaceAll('{to}', JSON.stringify(phone).slice(1, -1)).replaceAll('{message}', JSON.stringify(text).slice(1, -1));
        if (!Object.keys(headers).some((k) => k.toLowerCase() === 'content-type')) headers['Content-Type'] = 'application/json';
      }
      const res = await fetch(url, opts);
      if (!res.ok) throw new Error(`Gateway answered HTTP ${res.status}`);
    }
    await record(phone, text, kind, 'sent');
    return { sent: true };
  } catch (e) {
    await record(phone, text, kind, 'failed', e.message);
    return { sent: false, error: e.message };
  }
}

// Background delivery with a small delay between messages.
export function queueSms(items) {
  if (!smsEnabled() || !items.length) return;
  setImmediate(async () => {
    for (const it of items.slice(0, 2000)) { await sendSms(it); await new Promise((r) => setTimeout(r, 120)); }
  });
}

// Map studentId -> { name, phones[] } using the guardian phone on the student and the phone on linked parent records.
export async function guardianPhones(studentIds) {
  const [students, parents] = await Promise.all([
    Student.find({ _id: { $in: studentIds } }).select('name guardian').lean(),
    Parent.find({ children: { $in: studentIds } }).select('phone children').lean(),
  ]);
  const map = new Map(students.map((s) => [String(s._id), { name: s.name, raw: new Set(s.guardian?.phone ? [s.guardian.phone] : []) }]));
  for (const p of parents) for (const c of p.children) { const e = map.get(String(c)); if (e && p.phone) e.raw.add(p.phone); }
  for (const e of map.values()) { e.phones = [...new Set([...e.raw].map((x) => normalizePhone(x, env.sms.countryCode)).filter(Boolean))]; delete e.raw; }
  return map;
}

export async function alertAbsences(studentIds, date) {
  if (!smsEnabled() || !studentIds.length) return;
  const [phones, s] = await Promise.all([guardianPhones(studentIds), getSettings()]);
  const items = [];
  for (const e of phones.values()) for (const to of e.phones) items.push({ to, kind: 'absence', message: `${s.schoolName}: ${e.name} was marked absent today (${date}). Please contact the school if this is unexpected.` });
  queueSms(items);
}

export async function feeReminderSms(rows) { // rows: [{ _id: studentId, due }]
  if (!smsEnabled() || !rows.length) return 0;
  const [phones, s] = await Promise.all([guardianPhones(rows.map((r) => r._id)), getSettings()]);
  const items = [];
  for (const r of rows) { const e = phones.get(String(r._id)); if (e) for (const to of e.phones) items.push({ to, kind: 'fees', message: `${s.schoolName}: fee reminder for ${e.name}. Outstanding amount: ${r.due}. Please pay at the school office.` }); }
  queueSms(items);
  return items.length;
}

export async function announceSms(d) {
  if (!smsEnabled()) return;
  const roles = d.audience?.length ? d.audience : null;
  const users = await User.find({ active: true, phone: { $exists: true, $ne: '' }, ...(roles ? { role: { $in: roles } } : {}) }).select('phone').limit(2000).lean();
  const numbers = new Set(users.map((u) => normalizePhone(u.phone, env.sms.countryCode)).filter(Boolean));
  if (!roles || roles.includes('parent')) {
    const parents = await Parent.find({ phone: { $exists: true, $ne: '' } }).select('phone').limit(2000).lean();
    parents.forEach((p) => { const n = normalizePhone(p.phone, env.sms.countryCode); if (n) numbers.add(n); });
  }
  const s = await getSettings();
  const message = `${s.schoolName}: ${d.title}. ${d.body}`.slice(0, 300);
  queueSms([...numbers].map((to) => ({ to, message, kind: 'announcement' })));
}
