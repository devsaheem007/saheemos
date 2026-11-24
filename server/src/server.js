import fs from 'fs';
import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

fs.mkdirSync(env.uploadDir, { recursive: true });
await connectDb();
const app = createApp();
const server = app.listen(env.port, () => console.log(`SaheemOS API listening on :${env.port} (${env.nodeEnv})`));
const stop = () => server.close(() => process.exit(0));
process.on('SIGTERM', stop); process.on('SIGINT', stop);
