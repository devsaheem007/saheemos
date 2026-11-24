import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

let transporter;
function getTransport() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.port === 465,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

// Never throws. Returns { sent, error? } so callers can record failed deliveries.
export async function sendMail({ to, subject, text }) {
  const t = getTransport();
  if (!t) {
    console.log(`[mail not configured] to=${to} subject="${subject}"\n${text}`);
    return { sent: false, error: 'SMTP not configured' };
  }
  try {
    await t.sendMail({ from: env.smtp.from, to, subject, text });
    return { sent: true };
  } catch (e) {
    console.error('Mail failed:', e.message);
    return { sent: false, error: e.message };
  }
}
