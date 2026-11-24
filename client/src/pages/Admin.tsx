import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { AnimatePresence } from 'framer-motion';
import { ResourcePage, ResourceConfig } from '../components/ResourcePage';
import { FormModal } from '../components/FormModal';
import { Empty, PageTitle, Skeleton } from '../components/Common';
import { api, errMsg } from '../lib/api';
import { toast, useAuth } from '../lib/store';

const ROLES = ['owner', 'admin', 'principal', 'vice_principal', 'accountant', 'teacher', 'class_teacher', 'student', 'parent', 'librarian', 'receptionist', 'transport_manager', 'hr_manager', 'exam_controller', 'support_staff'];

/* ---------- User accounts ---------- */
const userCfg: ResourceConfig = {
  key: 'users', endpoint: '/users', title: 'User accounts', singular: 'User', sub: 'Logins for staff, students and parents. Passwords are never shown.', canDelete: false,
  filters: [{ name: 'role', label: 'Role', options: ROLES }],
  columns: [{ key: 'name', label: 'Name' }, { key: 'email', label: 'Email' }, { key: 'role', label: 'Role', render: (r) => <span className="badge">{r.role.replace(/_/g, ' ')}</span> }, { key: 'active', label: 'Active', render: (r) => (r.active ? 'Yes' : <b className="text-red-700">Deactivated</b>) }, { key: 'lastLoginAt', label: 'Last sign-in' }],
  fields: [],
};
export function UsersPage() {
  const [row, setRow] = useState<any>(null); const qc = useQueryClient();
  const pw = { name: 'password', label: 'Password', type: 'password' as const, hint: '10+ characters with upper case, lower case and a number. The user must change it at first sign-in.' };
  const profileHint = 'Paste the record ID of the Student, Parent, Teacher or Staff profile this login belongs to (required for student and parent logins).';
  return (<>
    <ResourcePage cfg={{ ...userCfg, canEdit: false }}
      renderActions={(u) => <button className="btn-ghost !px-2" onClick={() => setRow(u)}>Manage</button>} />
    <AnimatePresence>{row && <FormModal title={`Manage ${row.name}`} onClose={() => setRow(null)} initial={row}
      fields={[{ name: 'name', label: 'Name', required: true, half: true }, { name: 'role', label: 'Role', type: 'select', options: ROLES, half: true }, { name: 'active', label: 'Account is active', type: 'checkbox' }, { name: 'profileId', label: 'Linked profile ID', hint: profileHint }, { ...pw, label: 'Reset password (optional)', required: false }]}
      onSubmit={async (v) => { await api.patch(`/users/${row._id}`, { ...v, password: v.password || undefined, profileId: v.profileId || '' }); toast.ok('Account updated'); qc.invalidateQueries({ queryKey: ['/users'] }); }} />}</AnimatePresence>
  </>);
}
export function NewUserButton() { return null; }

/* ---------- Create user lives on the same page via a toolbar-less modal ---------- */
export function UsersWithCreate() {
  const { can } = useAuth(); const [open, setOpen] = useState(false); const qc = useQueryClient();
  return (<>
    {can('users', 'c') && <div className="mb-3 flex justify-end"><button className="btn" onClick={() => setOpen(true)}>Create user account</button></div>}
    <UsersPage />
    <AnimatePresence>{open && <FormModal title="Create user account" submitLabel="Create account" onClose={() => setOpen(false)}
      fields={[{ name: 'name', label: 'Full name', required: true, half: true }, { name: 'email', label: 'Email', type: 'email', required: true, half: true }, { name: 'role', label: 'Role', type: 'select', options: ROLES, required: true, half: true }, { name: 'password', label: 'Temporary password', type: 'password', required: true, half: true, hint: '10+ characters, upper & lower case and a number.' }, { name: 'profileId', label: 'Linked profile ID (students & parents)', hint: 'Copy the record ID from the student or parent profile.' }]}
      onSubmit={async (v) => { await api.post('/users', { ...v, profileId: v.profileId || '' }); toast.ok('Account created'); qc.invalidateQueries({ queryKey: ['/users'] }); }} />}</AnimatePresence>
  </>);
}

/* ---------- School settings ---------- */
export function SettingsPage() {
  const { can } = useAuth(); const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: async () => (await api.get('/settings')).data });
  const [edit, setEdit] = useState(false); const [sms, setSms] = useState(false);
  if (isLoading) return <Skeleton />;
  const rows: [string, any][] = [['School name', data.schoolName], ['Tagline', data.tagline], ['Address', data.address], ['Phone', data.phone], ['Email', data.email], ['Principal', data.principalName], ['Working days for payroll', data.payrollWorkingDays],
    ['SMS provider', data.smsConfigured ? 'Configured' : 'Not configured (set SMS_PROVIDER in the server .env)'], ['SMS absence alerts', data.smsAbsenceAlerts ? 'On' : 'Off'], ['SMS fee reminders', data.smsFeeReminders ? 'On' : 'Off']];
  return (
    <div>
      <PageTitle title="School settings" sub="Identity shown on the public website, receipts and report cards">{can('settings', 'u') && <><button className="btn-ghost" onClick={() => setSms(true)}>Send test SMS</button><button className="btn" onClick={() => setEdit(true)}>Edit settings</button></>}</PageTitle>
      <div className="card divide-y divide-sand dark:divide-charcoal">{rows.map(([k, v]) => <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm"><span className="opacity-60">{k}</span><span className="text-right">{v || <span className="opacity-40">Not set</span>}</span></div>)}</div>
      <AnimatePresence>{sms && <FormModal title="Send test SMS" submitLabel="Send" onClose={() => setSms(false)} fields={[{ name: 'to', label: 'Phone number (e.g. 03001234567)', required: true }]} onSubmit={async (v) => { const { data: r } = await api.post('/settings/test-sms', v); if (!r.sent) throw new Error(r.error || 'SMS failed'); toast.ok('Test SMS sent'); }} />}</AnimatePresence>
      <AnimatePresence>{edit && <FormModal wide title="Edit school settings" initial={data} onClose={() => setEdit(false)}
        fields={[{ name: 'schoolName', label: 'School name', required: true }, { name: 'tagline', label: 'Tagline' }, { name: 'logoUrl', label: 'Logo', type: 'file' }, { name: 'address', label: 'Address', type: 'textarea' }, { name: 'phone', label: 'Phone', half: true }, { name: 'email', label: 'Public email', half: true }, { name: 'about', label: 'About the school', type: 'textarea' }, { name: 'principalName', label: 'Principal name', half: true }, { name: 'payrollWorkingDays', label: 'Payroll working days / month', type: 'number', half: true }, { name: 'principalMessage', label: "Principal's message", type: 'textarea' }, { name: 'programs', label: 'Academic programs (one per line)', type: 'lines' }, { name: 'facilities', label: 'Facilities (one per line)', type: 'lines' }, { name: 'admissionsInfo', label: 'Admissions information', type: 'textarea' }, { name: 'smsAbsenceAlerts', label: 'Text guardians when a student is marked absent (needs an SMS provider)', type: 'checkbox' }, { name: 'smsFeeReminders', label: 'Also text guardians with fee reminders', type: 'checkbox' }]}
        onSubmit={async (v) => { await api.put('/settings', v); toast.ok('Settings saved'); qc.invalidateQueries({ queryKey: ['settings'] }); qc.invalidateQueries({ queryKey: ['site'] }); }} />}</AnimatePresence>
    </div>
  );
}

/* ---------- Notifications ---------- */
export function NotificationsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['notifs'], queryFn: async () => (await api.get('/notifications')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['notifs'] }); qc.invalidateQueries({ queryKey: ['notif-count'] }); };
  return (
    <div>
      <PageTitle title="Notifications" sub="Your recent school updates">{!!data?.unread && <button className="btn-ghost" onClick={async () => { await api.post('/notifications/read-all'); refresh(); }}>Mark all read</button>}</PageTitle>
      {isLoading ? <Skeleton /> : !data.items.length ? <div className="card"><Empty title="You're all caught up" hint="New announcements and alerts will appear here." /></div> : (
        <ul className="card divide-y divide-sand dark:divide-charcoal">{data.items.map((n: any) => (
          <li key={n._id} className={`flex items-start justify-between gap-3 px-4 py-3 ${n.read ? 'opacity-60' : ''}`}>
            <div><p className="text-sm font-semibold">{n.title}</p>{n.body && <p className="text-sm opacity-80">{n.body}</p>}<p className="mt-1 text-xs opacity-50">{new Date(n.createdAt).toLocaleString()}</p></div>
            {!n.read && <button className="btn-ghost !px-2 !py-1 text-xs" onClick={async () => { await api.post(`/notifications/${n._id}/read`); refresh(); }}>Mark read</button>}
          </li>))}</ul>)}
    </div>
  );
}

/* ---------- Profile & password ---------- */
const pwSchema = z.object({ current: z.string().min(1, 'Enter your current password'), password: z.string().min(10, 'At least 10 characters').regex(/[a-z]/, 'Add a lowercase letter').regex(/[A-Z]/, 'Add an uppercase letter').regex(/\d/, 'Add a number') });
export function ProfilePage() {
  const { user, load } = useAuth(); const [err, setErr] = useState('');
  const pw = useForm({ resolver: zodResolver(pwSchema) });
  const prof = useForm({ defaultValues: { name: user!.name, phone: user!.phone || '' } });
  return (
    <div className="max-w-xl space-y-5">
      <PageTitle title="Profile & password" sub={`${user!.email} · ${user!.role.replace(/_/g, ' ')}`} />
      <form className="card space-y-3 p-4" onSubmit={prof.handleSubmit(async (v) => { try { await api.patch('/auth/profile', v); await load(); toast.ok('Profile updated'); } catch (e) { toast.err(errMsg(e)); } })}>
        <h2 className="font-bold">Your details</h2>
        <div><label className="label" htmlFor="pn">Name</label><input id="pn" className="input" {...prof.register('name', { required: true })} /></div>
        <div><label className="label" htmlFor="pp">Phone</label><input id="pp" className="input" {...prof.register('phone')} /></div>
        <button className="btn">Save details</button>
      </form>
      <form className="card space-y-3 p-4" onSubmit={pw.handleSubmit(async (v) => { setErr(''); try { await api.post('/auth/change-password', v); await load(); toast.ok('Password changed'); pw.reset(); } catch (e) { setErr(errMsg(e)); } })}>
        <h2 className="font-bold">Change password</h2>
        <div><label className="label" htmlFor="cp">Current password</label><input id="cp" type="password" autoComplete="current-password" className="input" {...pw.register('current')} />{pw.formState.errors.current && <p className="mt-1 text-xs text-red-600">{pw.formState.errors.current.message as string}</p>}</div>
        <div><label className="label" htmlFor="np">New password</label><input id="np" type="password" autoComplete="new-password" className="input" {...pw.register('password')} />{pw.formState.errors.password && <p className="mt-1 text-xs text-red-600">{pw.formState.errors.password.message as string}</p>}</div>
        {err && <p className="text-sm text-red-600" role="alert">{err}</p>}
        <button className="btn">Change password</button>
        <p className="text-xs opacity-60">Changing your password signs you out of all other devices.</p>
      </form>
    </div>
  );
}
