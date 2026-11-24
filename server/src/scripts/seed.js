// First-run setup: creates the owner account, school settings and a current academic session.
// Safe to run repeatedly: it never overwrites existing data. It creates NO demo records.
import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { connectDb } from '../config/db.js';
import { User, Setting, Session } from '../models/index.js';
import { passwordSchema } from '../routes/auth.js';

await connectDb();
const { email, password, name } = env.seed;
if (!email || !password) { console.error('Set SEED_OWNER_EMAIL and SEED_OWNER_PASSWORD in .env first.'); process.exit(1); }
const check = passwordSchema.safeParse(password);
if (!check.success) { console.error('SEED_OWNER_PASSWORD is too weak:', check.error.issues.map((i) => i.message).join('; ')); process.exit(1); }

if (!(await User.exists({ role: 'owner' }))) {
  await User.create({ name, email: email.toLowerCase(), role: 'owner', passwordHash: await bcrypt.hash(password, 12) });
  console.log(`Owner account created: ${email}`);
} else console.log('An owner account already exists. Skipped.');

if (!(await Setting.exists({ key: 'school' }))) { await Setting.create({ key: 'school' }); console.log('Default school settings created. Edit them in Settings.'); }
if (!(await Session.exists({ isCurrent: true }))) {
  const y = new Date().getFullYear();
  await Session.create({ name: `${y}-${y + 1}`, startDate: new Date(y, 3, 1), endDate: new Date(y + 1, 2, 31), isCurrent: true });
  console.log('Academic session created. Adjust dates in Academics > Sessions.');
}
process.exit(0);
