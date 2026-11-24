import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { api, errMsg, downloadFile } from '../lib/api';
import { t } from '../lib/i18n';
import { toast, useAuth, PORTAL } from '../lib/store';
import { Empty, PageTitle, PrintSheet, SchoolLogo } from '../components/Common';

export default function Results() {
  const { user, can } = useAuth(); const portal = PORTAL.includes(user!.role);
  const [tab, setTab] = useState(portal ? 'card' : can('results', 'c') ? 'entry' : 'card');
  const exams = useQuery({ queryKey: ['exams-all'], queryFn: async () => (await api.get('/exams', { params: { limit: 200 } })).data.items });
  const [exam, setExam] = useState('');
  const examObj = (exams.data || []).find((e: any) => e._id === exam);
  const tabs = [...(can('results', 'c') ? [['entry', 'Enter marks']] : []), ['card', 'Report card'], ...(!portal ? [['class', 'Class results']] : [])];
  return (
    <div>
      <PageTitle title="Results" sub="Marks entry, report cards and class result sheets" />
      <div className="mb-4 flex flex-wrap gap-2">
        <select className="input !w-auto" value={exam} onChange={(e) => setExam(e.target.value)} aria-label="Exam"><option value="">Choose exam…</option>{(exams.data || []).map((e: any) => <option key={e._id} value={e._id}>{e.name} · {e.class?.name}{e.published ? '' : ' (draft)'}</option>)}</select>
        <div className="flex gap-1" role="tablist">{tabs.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'btn' : 'btn-ghost'} onClick={() => setTab(k)}>{l}</button>)}</div>
        {examObj && can('exams', 'u') && <button className="btn-ghost" onClick={async () => { try { await api.post(`/exams/${exam}/publish`, { published: !examObj.published }); toast.ok(examObj.published ? 'Results unpublished' : 'Results published'); exams.refetch(); } catch (e) { toast.err(errMsg(e)); } }}>{examObj.published ? 'Unpublish results' : 'Publish results'}</button>}
      </div>
      {!exam ? <Empty title="Choose an exam" hint="Select an exam above to continue." /> : tab === 'entry' ? <Entry exam={examObj} /> : tab === 'card' ? <Card exam={examObj} portal={portal} /> : <ClassSheet exam={examObj} />}
    </div>
  );
}

function Entry({ exam }: { exam: any }) {
  const [subject, setSubject] = useState(''); const [vals, setVals] = useState<Record<string, string>>({}); const [busy, setBusy] = useState(false);
  const students = useQuery({ queryKey: ['exam-students', exam?.class?._id], enabled: !!exam, queryFn: async () => (await api.get('/students', { params: { class: exam.class._id, status: 'active', limit: 500 } })).data.items });
  const existing = useQuery({ queryKey: ['exam-results', exam?._id, subject], enabled: !!exam && !!subject, queryFn: async () => (await api.get('/results', { params: { exam: exam._id, subject, limit: 500 } })).data.items });
  useEffect(() => { const m: Record<string, string> = {}; (existing.data || []).forEach((r: any) => (m[r.student._id] = String(r.marks))); setVals(m); }, [existing.data]);
  const entry = exam?.subjects?.find((s: any) => s.subject?._id === subject);
  const save = async () => {
    const records = Object.entries(vals).filter(([, v]) => v !== '').map(([student, v]) => ({ student, marks: Number(v) }));
    if (!records.length) return toast.err('Enter at least one mark');
    setBusy(true);
    try { const { data } = await api.post('/results/entry', { exam: exam._id, subject, records }); toast.ok(`Saved ${data.saved} marks`); existing.refetch(); } catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  if (!exam.subjects?.length) return <Empty title="This exam has no subjects yet" hint="Add subjects with maximum marks to the exam through the API or edit the exam record." />;
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-sand p-3 dark:border-charcoal">
        <select className="input !w-auto" value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject"><option value="">Choose subject…</option>{exam.subjects.map((s: any) => <option key={s.subject._id} value={s.subject._id}>{s.subject.name}</option>)}</select>
        {entry && <span className="text-sm opacity-70">Maximum marks: {entry.maxMarks} · Pass: {entry.passMarks}</span>}
        <button className="btn ms-auto" onClick={save} disabled={!subject || busy}>{busy && <Loader2 size={14} className="animate-spin" />}Save marks</button>
      </div>
      {!subject ? <Empty title="Choose a subject" /> : (
        <ul className="divide-y divide-sand dark:divide-charcoal">{(students.data || []).map((s: any) => (
          <li key={s._id} className="flex items-center justify-between gap-3 px-4 py-2"><span className="text-sm">{s.name} <span className="opacity-50">{s.admissionNo}</span></span>
            <input type="number" min={0} max={entry?.maxMarks} className="input !w-24" value={vals[s._id] ?? ''} onChange={(e) => setVals({ ...vals, [s._id]: e.target.value })} aria-label={`Marks for ${s.name}`} /></li>))}</ul>)}
    </div>
  );
}

function Card({ exam, portal }: { exam: any; portal: boolean }) {
  const { user } = useAuth(); const [student, setStudent] = useState(''); const [show, setShow] = useState(false);
  const students = useQuery({ queryKey: ['rc-students', exam?.class?._id], enabled: !!exam, queryFn: async () => (await api.get('/students', { params: { limit: 500, ...(portal ? {} : { class: exam.class._id }) } })).data.items });
  const card = useQuery({ queryKey: ['rc', exam?._id, student], enabled: !!student && show, queryFn: async () => (await api.get(`/results/report-card/${exam._id}/${student}`)).data, retry: false });
  const { data: site } = useQuery({ queryKey: ['site'], queryFn: async () => (await api.get('/public/site')).data });
  return (
    <div className="card p-4">
      <div className="flex flex-wrap gap-2">
        <select className="input !w-auto" value={student} onChange={(e) => { setStudent(e.target.value); setShow(false); }} aria-label="Student"><option value="">Choose student…</option>{(students.data || []).map((s: any) => <option key={s._id} value={s._id}>{s.name}</option>)}</select>
        <button className="btn" disabled={!student} onClick={() => setShow(true)}>View report card</button>
      </div>
      {show && card.error && <p className="mt-3 text-sm text-red-600" role="alert">{errMsg(card.error)}</p>}
      {show && card.data && (
        <PrintSheet title="Report card" onClose={() => setShow(false)} pdf={{ url: `/results/report-card/${exam._id}/${student}`, filename: 'report-card.pdf' }}>
          <SchoolLogo site={site} h={48} /><h2 className="text-xl font-bold">{site?.schoolName}</h2><p className="mb-2">Report card · {card.data.exam.name}</p>
          <p><b>{card.data.student.name}</b> · {card.data.student.admissionNo} · {card.data.student.class?.name} {card.data.student.section?.name || ''}</p>
          <table className="mt-3 w-full border-collapse text-sm"><thead><tr className="border-b"><th className="py-1 text-start">Subject</th><th className="text-end">Marks</th><th className="text-end">Out of</th><th className="text-end">Grade</th></tr></thead>
            <tbody>{card.data.subjects.map((s: any) => <tr key={s.code} className="border-b"><td className="py-1">{s.name}</td><td className="text-end">{s.marks}</td><td className="text-end">{s.max}</td><td className="text-end">{s.grade}</td></tr>)}</tbody>
            <tfoot><tr><td className="pt-2 font-bold">Total</td><td className="pt-2 text-end font-bold">{card.data.total}</td><td className="pt-2 text-end font-bold">{card.data.max}</td><td className="pt-2 text-end font-bold">{card.data.grade}</td></tr></tfoot></table>
          <p className="mt-3">Percentage: <b>{card.data.percentage}%</b> · Result: <b>{card.data.passed ? 'Pass' : 'Needs improvement'}</b></p>
        </PrintSheet>)}
      {!student && <p className="mt-3 text-sm opacity-60">{portal ? 'Only published results are shown.' : 'Pick a student to preview and print their report card.'} ({user!.role.replace('_', ' ')})</p>}
    </div>
  );
}

function ClassSheet({ exam }: { exam: any }) {
  const { data, isLoading } = useQuery({ queryKey: ['class-sum', exam._id], queryFn: async () => (await api.get('/results/class-summary', { params: { exam: exam._id } })).data.items });
  if (isLoading) return <p className="text-sm">Loading…</p>;
  if (!data?.length) return <Empty title="No marks entered for this exam yet" />;
  return (
    <div><div className="mb-2 flex justify-end gap-2">{(['xlsx', 'pdf'] as const).map((f) => <button key={f} className="btn-ghost" onClick={() => downloadFile('/results/class-summary', { exam: exam._id, format: f }, `class-results.${f}`).catch((e) => toast.err(errMsg(e)))}>{f === 'xlsx' ? t('Excel') : 'PDF'}</button>)}</div>
    <div className="card overflow-x-auto"><table className="w-full"><thead className="bg-sand-200 dark:bg-charcoal"><tr>{['Rank', 'Student', 'Total', 'Out of', '%', 'Grade'].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
      <tbody>{data.map((r: any) => <tr key={r.student?._id} className="border-t border-sand dark:border-charcoal"><td className="td">{r.rank}</td><td className="td">{r.student?.name}</td><td className="td">{r.total}</td><td className="td">{r.max}</td><td className="td">{r.percentage}</td><td className="td font-semibold">{r.grade}</td></tr>)}</tbody></table></div></div>
  );
}
