import { Notification, User } from '../models/index.js';
import { sendMail } from './mailer.js';

// Notify users by role (empty roles = every active user) or a specific user id list.
export async function notify({ roles = [], userIds, title, body, type = 'general', email = false }) {
  const q = { active: true };
  if (userIds) q._id = { $in: userIds };
  else if (roles.length) q.role = { $in: roles };
  const users = await User.find(q).select('_id email').limit(5000).lean();
  if (!users.length) return 0;
  const docs = await Notification.insertMany(users.map((u) => ({ user: u._id, title, body, type })));
  if (email) {
    // Background delivery; failures are recorded per notification, never thrown.
    (async () => {
      for (let i = 0; i < users.length; i++) {
        const r = await sendMail({ to: users[i].email, subject: title, text: body || title });
        await Notification.updateOne({ _id: docs[i]._id }, { emailStatus: r.sent ? 'sent' : 'failed' });
      }
    })();
  }
  return users.length;
}
