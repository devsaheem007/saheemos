// Removes the demo LOGIN accounts (@demo.school). Run before real use:  node src/scripts/remove-demo.js
// To also remove the sample school data (students, classes, invoices...), run:  node src/scripts/demo.js --reset
// and then enter your real data. (--reset keeps your owner account, settings and session.)
import { connectDb } from '../config/db.js';
import { User } from '../models/index.js';

await connectDb();
const r = await User.deleteMany({ email: /@demo\.school$/i, role: { $ne: 'owner' } });
console.log(`Removed ${r.deletedCount} demo accounts.`);
process.exit(0);
