import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, errMsg, isoDay, downloadFile } from '../lib/api';
import { t } from '../lib/i18n';
import { toast, useAuth, PORTAL } from '../lib/store';
import { Empty, PageTitle, Skeleton } from '../components/Common';

const STATUS = ['present', 'late', 'absent', 'leave'] as const;
const tone: Record<string, string> = { present: 'bg-forest text-ivory', late: 'bg-amber-500 text-white', absent: 'bg-red-700 text-white', leave: 'bg-sage text-white' };

export default function Attendance() {
  const { user, can } = useAuth(); const qc = useQueryClient();
  const portal = PORTAL.includes(user!.role); const canMark = can('attendance', 'c');
  const [kind, setKind] = useState<'student' | 'teacher' | 'staff'>('student');
  const [date, setDate] = useState(isoDay()); const [cls, setCls] = useState(''); const [marks, setMarks] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const [month, setMonth] = useState(isoDay().slice(0, 7));

  const classes = useQuery({ queryKey: ['classes-all'], queryFn: async () => (await api.get('/classes', { params: { limit: 200 } })).data.items, enabled: !portal });
  const roster = useQuery({
    queryKey: ['roster', kind, cls], enabled: !portal && canMark && (kind !== 'student' || !!cls),
    queryFn: async () => (await api.get(kind === 'student' ? '/students' : kind === 'teacher' ? '/teachers' : '/staff', { params: { limit: 500, status: 'active', ...(kind === 'student' ? { class: cls } : {}) } })).data.items,
  });
  const existing = useQuery({
    queryKey: ['att-day', kind, date, cls], enabled: !portal && canMark && (kind !== 'student' || !!cls),
    queryFn: async () => (await api.get('/attendance', { params: { kind, date, limit: 500, ...(kind === 'student' ? { class: cls } : {}) } })).data.items,
  });
  useEffect(() => {
    const m: Record<string, string> = {};
    (existing.data || []).forEach((r: any) => { m[r.person?._id || r.person] = r.status; });
    setMarks(m);
  }, [existing.data]);

  const summary = useQuery({ queryKey: ['att-sum', kind, month, cls], queryFn: async () => (await api.get('/attendance/summary', { params: { kind, month, class: kind === 'student' && cls ? cls : undefined } })).data });

  const save = async () => {
    const records = Object.entries(marks).map(([person, status]) => ({ person, status }));
    if (!records.length) return toast.err('Mark at least one person first');
    setBusy(true);
    try { const { data } = await api.post('/attendance/bulk', { kind, date, class: kind === 'student' ? cls : undefined, records }); toast.ok(`Saved ${data.saved} records`); qc.invalidateQueries({ queryKey: ['att-day'] }); qc.invalidateQueries({ queryKey: ['att-sum'] }); }
    catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };

  return (
    <div>
      <PageTitle title="Attendance" sub={portal ? 'Monthly attendance summary' : 'Mark daily registers and review monthly summaries'} />
      {!portal && (
        <div className="mb-4 flex flex-wrap gap-2">
          <select className="input !w-auto" value={kind} onChange={(e) => { setKind(e.target.value as any); setMarks({}); }} aria-label="Who">
            <option value="student">Students</option>{can('teachers', 'r') && user!.role !== 'teacher' && user!.role !== 'class_teacher' && <><option value="teacher">Teachers</option><option value="staff">Staff</option></>}
          </select>
          {kind === 'student' && <select className="input !w-auto" value={cls} onChange={(e) => setCls(e.target.value)} aria-label="Class"><option value="">Choose class…</option>{(classes.data || []).map((c: any) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}
          {canMark && <input type="date" className="input !w-auto" value={date} max={isoDay()} onChange={(e) => setDate(e.target.value)} aria-label="Date" />}
        </div>)}

      {!portal && canMark && (
        <div className="card mb-6 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand p-3 dark:border-charcoal">
            <h2 className="font-bold">Register for {date}</h2>
            <div className="flex gap-2"><button className="btn-ghost" onClick={() => { const m: any = {}; (roster.data || []).forEach((p: any) => (m[p._id] = marks[p._id] || 'present')); setMarks(m); }}>{t('Mark all present')}</button>
              <button className="btn" onClick={save} disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}{t('Save attendance')}</button></div>
          </div>
          {kind === 'student' && !cls ? <Empty title="Choose a class" hint="Pick a class above to load its register." /> : roster.isLoading ? <Skeleton /> : !(roster.data || []).length ? <Empty title="No active people found" /> : (
            <ul className="divide-y divide-sand dark:divide-charcoal">
              {roster.data.map((p: any) => (
                <li key={p._id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-sm font-medium">{p.name} <span className="opacity-50">{p.admissionNo || p.employeeId}</span></span>
                  <div className="flex gap-1" role="group" aria-label={`Status for ${p.name}`}>
                    {STATUS.map((s) => <button key={s} onClick={() => setMarks({ ...marks, [p._id]: s })} aria-pressed={marks[p._id] === s} className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition ${marks[p._id] === s ? tone[s] : 'bg-sand text-charcoal dark:bg-charcoal dark:text-sand'}`}>{t(s)}</button>)}
                  </div>
                </li>))}
            </ul>)}
        </div>)}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-sand p-3 dark:border-charcoal">
          <h2 className="font-bold">{t('Monthly summary')}</h2>
          <div className="flex flex-wrap gap-2"><input type="month" className="input !w-auto" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month" />{(['xlsx', 'pdf'] as const).map((f) => <button key={f} className="btn-ghost" onClick={() => downloadFile('/attendance/summary', { kind, month, class: kind === 'student' && cls ? cls : undefined, format: f }, `attendance-${month}.${f}`).catch((e) => toast.err(errMsg(e)))}>{f === 'xlsx' ? t('Excel') : 'PDF'}</button>)}</div>
        </div>
        {summary.isLoading ? <Skeleton rows={3} /> : !summary.data?.items.length ? <Empty title="No attendance recorded for this month" /> : (
          <div className="overflow-x-auto"><table className="w-full"><thead className="bg-sand-200 dark:bg-charcoal"><tr>{['Name', 'Present', 'Late', 'Absent', 'Leave', 'Attendance'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody>{summary.data.items.map((r: any) => <tr key={r.person} className="border-t border-sand dark:border-charcoal"><td className="td">{r.name}</td><td className="td">{r.present}</td><td className="td">{r.late}</td><td className="td">{r.absent}</td><td className="td">{r.leave}</td><td className="td font-semibold">{r.percentage}%</td></tr>)}</tbody></table></div>)}
      </div>
    </div>
  );
}
