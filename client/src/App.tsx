import { ReactNode, useEffect } from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth, homeFor } from './lib/store';
import { useLang } from './lib/i18n';
import MessagesPage from './pages/Messages';
import { AppLayout } from './components/Layout';
import { ResourcePage } from './components/ResourcePage';
import { LogoMark } from './components/Logo';
import { R } from './lib/resources';
import { Login, Forgot, Reset } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import MyPortal from './pages/MyPortal';
import Attendance from './pages/Attendance';
import Finance from './pages/Finance';
import Results from './pages/Results';
import { AssignmentsPage } from './pages/Learning';
import { ExamsPage, PayrollPage, LibraryPage, LoansPage, InventoryPage, LeavesPage } from './pages/Modules';
import { UsersWithCreate, SettingsPage, NotificationsPage, ProfilePage } from './pages/Admin';
import { PublicLayout, Home, About, Academics, Admissions, News, Contact } from './pages/public/Public';
import { Empty } from './components/Common';

function Protected({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <div className="grid min-h-screen place-items-center"><LogoMark size={56} /></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function Generic() {
  const { key } = useParams(); const { can } = useAuth();
  const cfg = key ? R[key] : undefined;
  if (!cfg) return <Empty title="Page not found" />;
  if (!can(cfg.key, 'r')) return <Empty title="You do not have access to this page" />;
  return <ResourcePage cfg={cfg} />;
}

function Gate({ perm, children }: { perm: string; children: ReactNode }) {
  const { can } = useAuth();
  return can(perm, 'r') ? <>{children}</> : <Empty title="You do not have access to this page" />;
}

function Index() {
  const { user } = useAuth();
  return ['student', 'parent', 'teacher', 'class_teacher'].includes(user!.role) ? <Navigate to="/app/me" replace /> : <Dashboard />;
}

export default function App() {
  const load = useAuth((s) => s.load); const user = useAuth((s) => s.user); const lang = useLang((s) => s.lang);
  useEffect(() => { load(); }, [load]);
  return (
    <Routes key={lang}>
      <Route element={<PublicLayout />}>
        <Route index element={<Home />} /><Route path="about" element={<About />} /><Route path="academics" element={<Academics />} />
        <Route path="admissions" element={<Admissions />} /><Route path="news" element={<News />} /><Route path="contact" element={<Contact />} />
      </Route>
      <Route path="/login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />
      <Route path="/forgot" element={<Forgot />} />
      <Route path="/reset/:token" element={<Reset />} />
      <Route path="/app" element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Index />} />
        <Route path="me" element={<MyPortal />} />
        <Route path="attendance" element={<Gate perm="attendance"><Attendance /></Gate>} />
        <Route path="finance" element={<Gate perm="invoices"><Finance /></Gate>} />
        <Route path="results" element={<Gate perm="results"><Results /></Gate>} />
        <Route path="payroll" element={<Gate perm="payroll"><PayrollPage /></Gate>} />
        <Route path="library" element={<Gate perm="books"><LibraryPage /></Gate>} />
        <Route path="inventory" element={<Gate perm="inventory"><InventoryPage /></Gate>} />
        <Route path="leaves" element={<Gate perm="leaves"><LeavesPage /></Gate>} />
        <Route path="users" element={<Gate perm="users"><UsersWithCreate /></Gate>} />
        <Route path="settings" element={<Gate perm="settings"><SettingsPage /></Gate>} />
        <Route path="notifications" element={<NotificationsPage />} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="r/exams" element={<Gate perm="exams"><ExamsPage /></Gate>} />
        <Route path="r/assignments" element={<Gate perm="assignments"><AssignmentsPage /></Gate>} />
        <Route path="r/bookTransactions" element={<Gate perm="bookTransactions"><LoansPage /></Gate>} />
        <Route path="r/:key" element={<Generic />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
