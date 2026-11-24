# SaheemOS — The Operating System for Education.

A single-school management system: MongoDB, Express, React + Vite + TypeScript + Tailwind. One school, one database, role-based accounts. There is no multi-school, tenant or subscription logic anywhere.

## 1. Run it locally

Requirements: Node 18.18+ and MongoDB (local, Atlas, or `docker compose up -d`).

```bash
npm run install:all
cp server/.env.example server/.env     # fill it in yourself (see below)
npm run seed                           # owner login + settings + a session. No demo data.
npm run dev:server                     # API on http://localhost:5000   (terminal 1)
npm run dev:client                     # app on http://localhost:5173   (terminal 2)
```

Required in `server/.env`: `MONGODB_URI`, `JWT_SECRET` (32+ random characters), `SEED_OWNER_EMAIL`, `SEED_OWNER_PASSWORD` (10+ chars with upper, lower and a number).
Optional: SMTP (emails), SMS provider, `TEST_MONGODB_URI` (integration tests). No `.env` file is included in this project.

Sample data for trying every module: `cd server && node src/scripts/demo.js` (add `--reset` to wipe existing school data first). It prints demo logins. Remove them before real use with `node src/scripts/remove-demo.js`.

## 2. Features

| Area | What is included |
|---|---|
| Security | Login with lockout, password reset by email, 15 roles with permissions enforced on the server, parent/student/teacher data scoping, CSRF header, rate limits, audit log |
| People | Students, parents, teachers, staff, photos, auto IDs, promotion/transfer history |
| Academics | Sessions, classes, sections, subjects, timetable, attendance (student/teacher/staff), exams, marks, grades, report cards, class rankings |
| Learning | Assignments, student submissions, grading with feedback |
| Fees | Structures, invoices, discounts, scholarships, partial payments (idempotent), receipts, overdue reminders, income/expense summary |
| Payroll | Calculation from salary and absences, approve, mark paid with a bank reference, payslips |
| Operations | Library (issue/return/fines), transport, inventory with low-stock alerts, leave requests |
| Communication | Announcements, in-app notifications, **internal messaging**, optional **email**, optional **SMS** |
| Exports | **Excel (.xlsx), PDF and CSV** for every list, attendance summary and class results; PDF receipts, payslips and report cards |
| Languages | English and **Urdu with right-to-left layout**, switchable anywhere |
| Public website | Home, about, academics, admissions + inquiry form, news, events, contact, school logo |
| Dashboards | Admin dashboard with charts; teacher, student and parent portals |

### Internal messaging
Everyone signed in can use Messages (inbox, sent, threads, replies, delete-for-me). Students and parents can only write to school staff (teachers, principals, admins, accountants, receptionists), never to each other. Only the sender and recipients can read a message. Recipients get an in-app notification. Sending is limited to 40 messages per hour per user.

### SMS alerts
Off until you set `SMS_PROVIDER` in `server/.env`:
- `twilio`: set `SMS_TWILIO_SID`, `SMS_TWILIO_TOKEN`, `SMS_TWILIO_FROM`.
- `http`: any local gateway with a simple HTTP API. Put `{to}` and `{message}` placeholders in `SMS_HTTP_URL` (and optionally `SMS_HTTP_BODY` / `SMS_HTTP_HEADERS` as JSON text). Set `SMS_HTTP_METHOD` to GET or POST. Note: some gateways answer HTTP 200 even on errors, so check your gateway's reply format and use **Send test SMS** in School settings.
Numbers like `03001234567` are converted to `+92…` (change `SMS_COUNTRY_CODE` for other countries).
Turn on in School settings: *absence alerts* (texts the guardian when a student is marked absent today), *fee reminders* (with "Remind overdue"). Announcements have an "Also send by SMS" box. Every attempt is recorded in the **SMS log**.

### Exports
Use the **Export** menu on any list (CSV, Excel, PDF). PDFs use a built-in Latin font. For Urdu text in documents, use Excel export or the on-screen Print button, which uses your browser's fonts. PDF tables show the first 9 columns; Excel has all columns.

### Urdu / RTL
Use the language button (top bar, login page, public site). The interface labels are translated and the layout flips right-to-left. Text stored in the database (student names, announcements, about text) appears exactly as you type it; type it in Urdu if you want it in Urdu. Strings missing from the dictionary (`client/src/lib/i18n.ts`) stay in English; add or correct translations there. Have a native speaker review the wording before launch.

## 3. What is not included
- **Online payment gateway.** Manual cash, bank and cheque recording works. `/api/payments/webhook` returns 501 until a provider adapter is added (see section 6).
- Salary allowances/deductions editing in the UI (only basic salary), student document upload screen, bulk class promotion, automatic library-fine/transport-fee invoicing.
- Per-owner private file access (files need sign-in; the random link is the secret).
- Browser (click-through) tests.

## 4. Testing
```bash
cd server
npm test                                  # unit tests (always) + integration tests (if TEST_MONGODB_URI is set)
```
Integration tests need a throwaway database: `TEST_MONGODB_URI=mongodb://127.0.0.1:27017/saheemos_test` (name must end in `_test`; it is wiped). They cover login and lockout, CSRF, parent/student/teacher scoping, payments (idempotency, overpayment), messaging rules and public endpoints.
Client type check: `npm --prefix client run typecheck`.

## 5. Production deployment
1. MongoDB: Atlas or a self-hosted instance with authentication, firewall and backups.
2. On the server: `npm run install:all`, create `server/.env` with `NODE_ENV=production`, a fresh 32+ char `JWT_SECRET`, `CLIENT_URL=https://school.example.com`, SMTP and (optional) SMS settings, an absolute `UPLOAD_DIR` outside the code folder. Run `npm run seed` once.
3. `npm run build` (outputs `client/dist`). Leave `VITE_API_URL` empty.
4. `pm2 start deploy/ecosystem.config.cjs && pm2 save`.
5. Serve `client/dist` and proxy `/api` with Nginx (`deploy/nginx.conf`). HTTPS: `certbot --nginx -d school.example.com`.
6. Backups: schedule `scripts/backup.sh`; test a restore; keep copies off the server.
7. Before launch: `node src/scripts/remove-demo.js`, and make sure no sample data remains.

## 6. Adding a payment gateway
Choose a provider available in your country. In `server/src/routes/finance.js` replace the `webhookRouter` handler with an adapter that (1) reads the raw body, (2) verifies the provider's signature, (3) finds the invoice from provider metadata and (4) records the payment with the provider event ID as `idempotencyKey`, reusing the logic of `POST /api/invoices/:id/payments`. Never store card data.

## 7. Layout
```
server/src/config      env, db, permissions matrix
server/src/models      Mongoose models
server/src/routes      auth, users, attendance, finance, exams, operations, messages, dashboard, public
server/src/utils       CRUD factory, scopes, exporters, sms, mail, audit
server/test            unit + integration tests
client/src/lib         api client, stores, resources, i18n
client/src/components  layout, forms, tables, modals
client/src/pages       dashboard, modules, admin, messages, public website
deploy, scripts        nginx, pm2, backup
```
