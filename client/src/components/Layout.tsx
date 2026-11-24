import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, Bell, BookOpen, Bus, CalendarCheck, ChevronRight, ClipboardList, CreditCard, FileText, GraduationCap, LayoutDashboard, LogOut, Megaphone, Menu, Moon, Package, Settings, ShieldCheck, Sun, UserCog, Users, Wallet, X, Library, Inbox, CalendarDays, Layers, Receipt, Briefcase, UserSquare } from 'lucide-react';
import { api } from '../lib/api';
import { useAuth, PORTAL } from '../lib/store';
import { Logo } from './Logo';
import { Toasts, LangToggle } from './Common';
import { isRtl, t } from '../lib/i18n';

interface Item { to: string; label: string; icon: any; perm?: string; roles?: string[]; end?: boolean }
const GROUPS: { title: string; items: Item[] }[] = [
  { title: 'Overview', items: [
    { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ['!student', '!parent', '!teacher', '!class_teacher'] },
    { to: '/app/me', label: 'My portal', icon: UserSquare, roles: ['student', 'parent', 'teacher', 'class_teacher'] },
  ] },
  { title: 'People', items: [
    { to: '/app/r/students', label: 'Students', icon: GraduationCap, perm: 'students', roles: ['!student', '!parent'] },
    { to: '/app/r/parents', label: 'Parents', icon: Users, perm: 'parents' },
    { to: '/app/r/teachers', label: 'Teachers', icon: Briefcase, perm: 'teachers' },
    { to: '/app/r/staff', label: 'Staff', icon: Users, perm: 'staff' },
    { to: '/app/users', label: 'User accounts', icon: UserCog, perm: 'users' },
  ] },
  { title: 'Academics', items: [
    { to: '/app/r/sessions', label: 'Sessions', icon: CalendarDays, perm: 'sessions', roles: ['!student', '!parent'] },
    { to: '/app/r/classes', label: 'Classes', icon: Layers, perm: 'classes', roles: ['!student', '!parent'] },
    { to: '/app/r/sections', label: 'Sections', icon: Layers, perm: 'sections', roles: ['!student', '!parent'] },
    { to: '/app/r/subjects', label: 'Subjects', icon: BookOpen, perm: 'subjects' },
    { to: '/app/r/timetables', label: 'Timetable', icon: CalendarDays, perm: 'timetables' },
    { to: '/app/attendance', label: 'Attendance', icon: CalendarCheck, perm: 'attendance' },
    { to: '/app/r/exams', label: 'Exams', icon: ClipboardList, perm: 'exams' },
    { to: '/app/results', label: 'Results', icon: FileText, perm: 'results' },
    { to: '/app/r/assignments', label: 'Assignments', icon: FileText, perm: 'assignments' },
    { to: '/app/r/submissions', label: 'Submissions', icon: Inbox, perm: 'submissions' },
  ] },
  { title: 'Finance', items: [
    { to: '/app/finance', label: 'Fee invoices', icon: Receipt, perm: 'invoices' },
    { to: '/app/r/feeStructures', label: 'Fee structures', icon: CreditCard, perm: 'feeStructures' },
    { to: '/app/r/expenses', label: 'Expenses', icon: Wallet, perm: 'expenses' },
    { to: '/app/payroll', label: 'Payroll', icon: Wallet, perm: 'payroll' },
  ] },
  { title: 'Operations', items: [
    { to: '/app/library', label: 'Library', icon: Library, perm: 'books' },
    { to: '/app/r/bookTransactions', label: 'Loans', icon: BookOpen, perm: 'bookTransactions' },
    { to: '/app/r/vehicles', label: 'Vehicles', icon: Bus, perm: 'vehicles' },
    { to: '/app/r/routes', label: 'Routes', icon: Bus, perm: 'routes' },
    { to: '/app/leaves', label: 'Leave', icon: CalendarDays, perm: 'leaves' },
    { to: '/app/inventory', label: 'Inventory', icon: Package, perm: 'inventory' },
  ] },
  { title: 'Communication', items: [
    { to: '/app/messages', label: 'Messages', icon: MessageSquare },
    { to: '/app/r/announcements', label: 'Announcements', icon: Megaphone, perm: 'announcements' },
    { to: '/app/r/inquiries', label: 'Inquiries', icon: Inbox, perm: 'inquiries' },
  ] },
  { title: 'Administration', items: [
    { to: '/app/settings', label: 'School settings', icon: Settings, perm: 'settings' },
    { to: '/app/r/auditLogs', label: 'Audit log', icon: ShieldCheck, perm: 'auditLogs' },
    { to: '/app/r/smsLogs', label: 'SMS log', icon: MessageSquare, perm: 'smsLogs' },
  ] },
];

const roleOk = (roles: string[] | undefined, role: string) => {
  if (!roles) return true;
  const neg = roles.filter((r) => r.startsWith('!')).map((r) => r.slice(1));
  if (neg.length && neg.includes(role)) return false;
  const pos = roles.filter((r) => !r.startsWith('!'));
  return pos.length ? pos.includes(role) : true;
};

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { user, can } = useAuth();
  const { data: unread } = useQuery({ queryKey: ['msg-unread'], queryFn: async () => (await api.get('/messages/unread-count')).data.unread, refetchInterval: 60_000 });
  return (
    <nav className="flex h-full flex-col gap-4 overflow-y-auto p-4" aria-label="Main">
      <Link to="/app" onClick={onNavigate} className="mb-1 px-1"><Logo light /></Link>
      {GROUPS.map((g) => {
        const items = g.items.filter((i) => roleOk(i.roles, user!.role) && (!i.perm || can(i.perm, 'r')));
        if (!items.length) return null;
        return (
          <div key={g.title}>
            <p className="mb-1 px-2 text-xs font-semibold text-sand/50">{t(g.title)}</p>
            {items.map((i) => (
              <NavLink key={i.to} to={i.to} end={i.end} onClick={onNavigate}
                className={({ isActive }) => `flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition ${isActive ? 'bg-sand text-forest font-semibold' : 'text-sand/85 hover:bg-white/10'}`}>
                <i.icon size={16} />{t(i.label)}{i.to === '/app/messages' && !!unread && <span className="ms-auto rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{unread}</span>}
              </NavLink>))}
          </div>);
      })}
    </nav>
  );
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const parts = pathname.split('/').filter(Boolean).filter((p) => p !== 'r').slice(1);
  const pretty = (s: string) => s.replace(/([A-Z])/g, ' $1').replace(/-/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return (
    <ol className="flex items-center gap-1 text-sm text-charcoal/60 dark:text-sand/60">
      <li><Link to="/app" className="hover:underline">{t('Home')}</Link></li>
      {parts.map((p, i) => <li key={i} className="flex items-center gap-1"><ChevronRight size={13} className="rtl:rotate-180" />{t(pretty(p))}</li>)}
    </ol>
  );
}

export function AppLayout() {
  const { user, logout } = useAuth(); const nav = useNavigate();
  const [open, setOpen] = useState(false); const [dark, setDark] = useState(document.documentElement.classList.contains('dark'));
  const { data: notif } = useQuery({ queryKey: ['notif-count'], queryFn: async () => (await api.get('/notifications')).data, refetchInterval: 60_000 });
  const toggle = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle('dark', d); localStorage.setItem('saheemos-theme', d ? 'dark' : 'light'); };

  return (
    <div className="min-h-screen lg:ps-64">
      <aside className="no-print fixed inset-y-0 start-0 hidden w-64 bg-forest lg:block"><Sidebar /></aside>
      <AnimatePresence>
        {open && (
          <motion.div className="fixed inset-0 z-40 flex lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-charcoal-900/60" onClick={() => setOpen(false)} />
            <motion.aside initial={{ x: isRtl() ? 280 : -280 }} animate={{ x: 0 }} exit={{ x: isRtl() ? 280 : -280 }} transition={{ type: 'tween', duration: 0.2 }} className="relative h-full w-64 bg-forest">
              <button className="absolute end-3 top-4 text-sand" onClick={() => setOpen(false)} aria-label="Close menu"><X size={18} /></button>
              <Sidebar onNavigate={() => setOpen(false)} />
            </motion.aside>
          </motion.div>)}
      </AnimatePresence>

      <header className="no-print sticky top-0 z-30 flex items-center gap-3 border-b border-sand bg-ivory/90 px-4 py-3 backdrop-blur dark:border-charcoal dark:bg-charcoal-900/90">
        <button className="btn-ghost !p-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu"><Menu size={18} /></button>
        <div className="min-w-0 flex-1"><Breadcrumb /></div>
        <LangToggle />
        <button className="btn-ghost !p-2" onClick={toggle} aria-label="Toggle dark theme">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <Link to="/app/notifications" className="btn-ghost relative !p-2" aria-label="Notifications">
          <Bell size={16} />
          {!!notif?.unread && <span className="absolute -end-1 -top-1 rounded-full bg-red-600 px-1.5 text-[10px] font-bold text-white">{notif.unread > 9 ? '9+' : notif.unread}</span>}
        </Link>
        <div className="group relative">
          <button className="btn-ghost !px-2.5" aria-haspopup="menu">{user!.name.split(' ')[0]}</button>
          <div className="invisible absolute end-0 mt-1 w-52 rounded-lg border border-sand bg-white p-1 text-sm shadow-lg group-focus-within:visible group-hover:visible dark:border-charcoal dark:bg-charcoal-800" role="menu">
            <p className="px-3 py-2 text-xs opacity-60">{user!.email}<br />{user!.role.replace(/_/g, ' ')}</p>
            <Link to="/app/profile" className="block rounded px-3 py-2 hover:bg-sand-200 dark:hover:bg-charcoal" role="menuitem">{t('Profile & password')}</Link>
            <button className="flex w-full items-center gap-2 rounded px-3 py-2 text-start hover:bg-sand-200 dark:hover:bg-charcoal" role="menuitem" onClick={async () => { await logout(); nav('/login'); }}><LogOut size={14} />{t('Sign out')}</button>
          </div>
        </div>
      </header>

      {user!.mustChangePassword && (
        <div className="no-print bg-sand px-4 py-2 text-sm text-charcoal">Your password was set by an administrator. <Link className="font-semibold underline" to="/app/profile">Choose a new password</Link>.</div>)}
      <main className="mx-auto max-w-7xl p-4 sm:p-6"><motion.div key={useLocation().pathname} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}><Outlet /></motion.div></main>
      <Toasts />
    </div>
  );
}
export { PORTAL };
