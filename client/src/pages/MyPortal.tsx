import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api, errMsg, money } from '../lib/api';
import { Empty, PageTitle, Skeleton } from '../components/Common';
import { useAuth } from '../lib/store';

export default function MyPortal() {
  const { user } = useAuth();
  const { data, isLoading, error } = useQuery({ queryKey: ['me-dash'], queryFn: async () => (await api.get('/dashboard/me')).data });
  if (isLoading) return <Skeleton />;
  if (error) return <Empty title="Could not load" hint={errMsg(error)} />;
  if (data.kind === 'staff') {
    return (
      <div>
        <PageTitle title={`Welcome, ${user!.name.split(' ')[0]}`} sub="Your teaching overview" />
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="card p-4"><p className="text-xs opacity-60">Assignments you created</p><p className="font-display text-2xl font-extrabold">{data.assignments}</p></div>
          <div className="card p-4"><p className="text-xs opacity-60">Submissions awaiting grading</p><p className="font-display text-2xl font-extrabold">{data.submissionsToReview}</p></div>
          <Link to="/app/attendance" className="card p-4 hover:bg-sand-200 dark:hover:bg-charcoal"><p className="font-bold">Mark attendance</p><p className="text-sm opacity-60">Open today's class register</p></Link>
        </div>
      </div>);
  }
  return (
    <div>
      <PageTitle title="My portal" sub={user!.role === 'parent' ? 'Your children at a glance' : 'Your school life at a glance'} />
      {!data.children.length ? <Empty title="No student linked to this account yet" hint="Ask the school office to link your account." /> : (
        <div className="space-y-4">
          {data.children.map((c: any) => (
            <div key={c.student._id} className="card p-4">
              <h2 className="font-display text-lg font-bold">{c.student.name}</h2>
              <p className="mb-3 text-sm opacity-60">{c.student.admissionNo} · {c.student.class?.name || 'No class'} {c.student.section?.name || ''}</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg bg-sand-200 p-3 dark:bg-charcoal"><p className="text-xs opacity-60">Attendance</p><p className="text-xl font-bold">{c.attendancePercentage == null ? 'No records' : c.attendancePercentage + '%'}</p></div>
                <div className="rounded-lg bg-sand-200 p-3 dark:bg-charcoal"><p className="text-xs opacity-60">Outstanding fees</p><p className="text-xl font-bold">{money(c.outstandingFees)}</p></div>
                <div className="rounded-lg bg-sand-200 p-3 dark:bg-charcoal"><p className="text-xs opacity-60">Assignments due</p><p className="text-xl font-bold">{c.assignmentsDue}</p></div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-sm">
                <Link className="btn-ghost" to="/app/finance">Fees & receipts</Link><Link className="btn-ghost" to="/app/results">Results & report card</Link>
                <Link className="btn-ghost" to="/app/r/timetables">Timetable</Link><Link className="btn-ghost" to="/app/r/assignments">Assignments</Link><Link className="btn-ghost" to="/app/attendance">Attendance</Link>
              </div>
            </div>))}
        </div>)}
    </div>
  );
}
