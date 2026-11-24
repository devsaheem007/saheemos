import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, dateStr, errMsg, money } from '../lib/api';
import { Empty, PageTitle, Skeleton } from '../components/Common';
import { t } from '../lib/i18n';

const Stat = ({ label, value, i }: { label: string; value: any; i: number }) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="card p-4">
    <p className="text-xs font-semibold opacity-60">{t(label)}</p>
    <p className="mt-1 font-display text-2xl font-extrabold">{value}</p>
  </motion.div>
);

export default function Dashboard() {
  const { data, isLoading, error } = useQuery({ queryKey: ['dash'], queryFn: async () => (await api.get('/dashboard/stats')).data });
  if (isLoading) return <Skeleton rows={8} />;
  if (error) return <Empty title="Dashboard unavailable" hint={errMsg(error)} />;
  const d = data; const a = d.todayAttendance;
  const attPct = a.marked ? Math.round(((a.present + a.late) / a.marked) * 100) + '%' : t('Not marked');
  const stats: [string, any][] = [['Students', d.counts.students], ['Teachers', d.counts.teachers], ['Staff', d.counts.staff], ['Classes', d.counts.classes], ["Today's attendance", attPct]];
  if (d.pendingFees) stats.push(['Pending fees', money(d.pendingFees.amount)], ['Revenue this month', money(d.monthlyRevenue)]);
  if (d.lowStock) stats.push(['Low-stock items', d.lowStock]);
  const List = ({ title, rows, empty }: { title: string; rows: any[]; empty: string }) => (
    <div className="card p-4"><h2 className="mb-2 font-bold">{t(title)}</h2>{rows.length ? <ul className="divide-y divide-sand text-sm dark:divide-charcoal">{rows.map((r, i) => <li key={i} className="flex justify-between gap-3 py-2"><span>{r[0]}</span><span className="opacity-60">{r[1]}</span></li>)}</ul> : <p className="text-sm opacity-60">{empty}</p>}</div>
  );
  return (
    <div>
      <PageTitle title="Dashboard" sub="Live figures from your school's records" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{stats.map(([l, v], i) => <Stat key={l} label={l} value={v} i={i} />)}</div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {d.pendingFees && (
          <div className="card p-4"><h2 className="mb-2 font-bold">{t('Fee collection, last 6 months')}</h2>
            {d.revenueByMonth.length ? <div className="h-56"><ResponsiveContainer><BarChart data={d.revenueByMonth}><CartesianGrid strokeDasharray="3 3" stroke="#668B7055" /><XAxis dataKey="month" fontSize={12} /><YAxis fontSize={12} /><Tooltip /><Bar dataKey="total" fill="#244C3D" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div> : <p className="text-sm opacity-60">No payments recorded yet.</p>}
          </div>)}
        <div className="card p-4"><h2 className="mb-2 font-bold">{t('Student attendance, last 7 days')}</h2>
          {d.attendanceLast7.length ? <div className="h-56"><ResponsiveContainer><LineChart data={d.attendanceLast7}><CartesianGrid strokeDasharray="3 3" stroke="#668B7055" /><XAxis dataKey="date" fontSize={12} tickFormatter={(x) => x.slice(5)} /><YAxis domain={[0, 100]} fontSize={12} unit="%" /><Tooltip /><Line type="monotone" dataKey="percentage" stroke="#668B70" strokeWidth={2.5} dot /></LineChart></ResponsiveContainer></div> : <p className="text-sm opacity-60">No attendance marked in the last 7 days.</p>}
        </div>
        <List title="Recent admissions" empty="No students admitted yet." rows={d.recentAdmissions.map((s: any) => [`${s.name}${s.class ? ' · ' + s.class.name : ''}`, dateStr(s.createdAt)])} />
        <List title="Upcoming examinations" empty="No upcoming exams scheduled." rows={d.upcomingExams.map((e: any) => [`${e.name}${e.class ? ' · ' + e.class.name : ''}`, dateStr(e.startDate)])} />
        <List title="Events & pinned notices" empty="Nothing announced yet." rows={d.announcements.map((x: any) => [x.title, x.eventDate ? dateStr(x.eventDate) : x.pinned ? 'Pinned' : ''])} />
        {d.recentActivities.length > 0 && <List title="Recent activity" empty="" rows={d.recentActivities.map((x: any) => [`${x.userName || 'System'} · ${x.action} ${x.resource}`, new Date(x.createdAt).toLocaleTimeString()])} />}
      </div>
    </div>
  );
}
