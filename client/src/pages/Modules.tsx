import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { BookUp, Check, CornerDownLeft, PackagePlus, Printer, X, Plus } from 'lucide-react';
import { ResourcePage, ResourceConfig } from '../components/ResourcePage';
import { FormModal } from '../components/FormModal';
import { PrintSheet, SchoolLogo } from '../components/Common';
import { api, asId, errMsg, money, dateStr } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { R, refs } from '../lib/resources';

const run = async (fn: () => Promise<any>, ok: string, after?: () => void) => { try { await fn(); toast.ok(ok); after?.(); } catch (e) { toast.err(errMsg(e)); } };

/* ---------- Exams: add subjects to an exam ---------- */
export function ExamsPage() {
  const [row, setRow] = useState<any>(null);
  const qc = useQueryClient();
  return (<>
    <ResourcePage cfg={R.exams} renderActions={(r) => <button className="btn-ghost !px-2" onClick={() => setRow(r)}><Plus size={14} />Subject</button>} />
    <AnimatePresence>{row && <FormModal title={`Add subject to ${row.name}`} onClose={() => setRow(null)} fields={[
      { name: 'subject', label: 'Subject', type: 'ref', ref: refs.subject, required: true }, { name: 'date', label: 'Exam date', type: 'date', half: true },
      { name: 'maxMarks', label: 'Maximum marks', type: 'number', half: true, required: true }, { name: 'passMarks', label: 'Pass marks', type: 'number', half: true, required: true }]}
      initial={{ maxMarks: 100, passMarks: 40 }}
      onSubmit={async (v) => {
        const current = (row.subjects || []).map((s: any) => ({ subject: asId(s.subject), date: s.date, maxMarks: s.maxMarks, passMarks: s.passMarks }));
        if (current.some((s: any) => s.subject === v.subject)) throw new Error('That subject is already in this exam');
        await api.patch(`/exams/${row._id}`, { subjects: [...current, v] }); toast.ok('Subject added'); qc.invalidateQueries({ queryKey: ['/exams'] });
      }} />}</AnimatePresence>
  </>);
}

/* ---------- Payroll ---------- */
const payrollCfg: ResourceConfig = {
  key: 'payroll', endpoint: '/payroll', title: 'Payroll', singular: 'Payroll', sub: 'Calculation and approval. Marking paid records a confirmed bank transfer reference; SaheemOS does not move money.',
  canCreate: false, canEdit: false, canDelete: false, searchable: false,
  filters: [{ name: 'status', label: 'Status', options: ['draft', 'approved', 'paid'] }],
  columns: [{ key: 'month', label: 'Month' }, { key: 'person.name', label: 'Employee' }, { key: 'kind', label: 'Type' }, { key: 'basic', label: 'Basic', render: (r) => money(r.basic) }, { key: 'allowances', label: 'Allowances', render: (r) => money(r.allowances) }, { key: 'deductions', label: 'Deductions', render: (r) => money(r.deductions + r.absenceDeduction) }, { key: 'net', label: 'Net pay', render: (r) => <b>{money(r.net)}</b> }, { key: 'status', label: 'Status', render: (r) => <span className="badge">{r.status}</span> }],
  fields: [],
};
export function PayrollPage() {
  const { can } = useAuth(); const qc = useQueryClient();
  const [gen, setGen] = useState(false); const [paying, setPaying] = useState<any>(null); const [slip, setSlip] = useState<any>(null);
  const { data: site } = useQuery({ queryKey: ['site'], queryFn: async () => (await api.get('/public/site')).data });
  const reload = () => qc.invalidateQueries({ queryKey: ['/payroll'] });
  return (<>
    <ResourcePage cfg={payrollCfg}
      toolbar={can('payroll', 'c') && <button className="btn" onClick={() => setGen(true)}>Generate payroll</button>}
      renderActions={(r) => (<>
        {can('payroll', 'u') && r.status === 'draft' && <button className="btn-ghost !px-2" onClick={() => run(() => api.post(`/payroll/${r._id}/status`, { status: 'approved' }), 'Approved', reload)}><Check size={14} />Approve</button>}
        {can('payroll', 'u') && r.status === 'approved' && <button className="btn-ghost !px-2" onClick={() => setPaying(r)}>Mark paid</button>}
        <button className="btn-ghost !px-2" onClick={() => setSlip(r)}><Printer size={14} />Payslip</button></>)} />
    <AnimatePresence>
      {gen && <FormModal title="Generate payroll" submitLabel="Generate" onClose={() => setGen(false)} initial={{ month: new Date().toISOString().slice(0, 7) }} fields={[{ name: 'month', label: 'Month (YYYY-MM)', required: true, hint: 'Uses salary details, allowances, deductions and absent days from attendance. Approved or paid rows are never overwritten.' }]}
        onSubmit={async (v) => { const { data } = await api.post('/payroll/generate', v); toast.ok(`${data.created} generated, ${data.skipped} left unchanged`); reload(); }} />}
      {paying && <FormModal title="Record payment confirmation" submitLabel="Mark as paid" onClose={() => setPaying(null)} fields={[{ name: 'reference', label: 'Bank transfer / cheque reference', required: true, hint: 'Enter this only after the transfer has actually been confirmed by your bank.' }]}
        onSubmit={async (v) => { await api.post(`/payroll/${paying._id}/status`, { status: 'paid', reference: v.reference }); toast.ok('Marked as paid'); reload(); }} />}
      {slip && <PrintSheet title="Payslip" onClose={() => setSlip(null)} pdf={{ url: `/payroll/${slip._id}/payslip`, params: {}, filename: `payslip-${slip.month}.pdf` }}>
        <SchoolLogo site={site} h={48} /><h2 className="text-xl font-bold">{site?.schoolName}</h2><p className="mb-2">Payslip · {slip.month}</p>
        <p><b>{slip.person?.name}</b> {slip.person?.employeeId && `· ${slip.person.employeeId}`} {slip.person?.designation && `· ${slip.person.designation}`}</p>
        <table className="mt-3 w-full text-sm"><tbody>
          <tr><td className="py-1">Basic salary</td><td className="text-end">{money(slip.basic)}</td></tr><tr><td className="py-1">Allowances</td><td className="text-end">{money(slip.allowances)}</td></tr>
          <tr><td className="py-1">Deductions</td><td className="text-end">-{money(slip.deductions)}</td></tr><tr><td className="py-1">Absence ({slip.absentDays} of {slip.workingDays} days)</td><td className="text-end">-{money(slip.absenceDeduction)}</td></tr>
          <tr className="border-t font-bold"><td className="py-2">Net pay</td><td className="text-end">{money(slip.net)}</td></tr></tbody></table>
        <p className="mt-3 text-xs opacity-70">Status: {slip.status}{slip.payReference ? ` · reference ${slip.payReference}` : ''}</p></PrintSheet>}
    </AnimatePresence></>);
}

/* ---------- Library ---------- */
export function LibraryPage() {
  const { can } = useAuth(); const qc = useQueryClient(); const [book, setBook] = useState<any>(null); const [type, setType] = useState('Student');
  const eps: Record<string, any> = { Student: refs.student, Teacher: refs.teacher, Staff: { endpoint: '/staff', label: (r: any) => r.name } };
  return (<>
    <ResourcePage cfg={R.books} renderActions={(b) => can('bookTransactions', 'c') && b.available > 0 ? <button className="btn-ghost !px-2" onClick={() => setBook(b)}><BookUp size={14} />Issue</button> : null} />
    <AnimatePresence>{book && (
      <FormModal title={`Issue “${book.title}”`} submitLabel="Issue book" onClose={() => setBook(null)} initial={{ days: 14, borrowerModel: 'Student' }}
        fields={[{ name: 'borrowerModel', label: 'Borrower type', type: 'select', options: ['Student', 'Teacher', 'Staff'], required: true, half: true }, { name: 'days', label: 'Loan days', type: 'number', half: true, required: true }, { name: 'borrower', label: 'Borrower', type: 'ref', ref: eps[type], required: true }]}
        onSubmit={async (v) => { setType(v.borrowerModel); await api.post(`/library/books/${book._id}/issue`, { ...v, days: Number(v.days) }); toast.ok('Book issued'); qc.invalidateQueries({ queryKey: ['/books'] }); }} />)}
    </AnimatePresence>
    <p className="mt-3 text-xs opacity-60">Tip: choose the borrower type, save once, and reopen if the list shows the wrong group.</p>
  </>);
}
export function LoansPage() {
  const { can } = useAuth();
  return <ResourcePage cfg={R.bookTransactions} extraParams={{}} renderActions={(t, reload) => can('bookTransactions', 'u') && !t.returnedAt ? <button className="btn-ghost !px-2" onClick={() => run(async () => { const { data } = await api.post(`/library/transactions/${t._id}/return`); if (data.fine) toast.ok(`Fine due: ${money(data.fine)}`); }, 'Book returned', reload)}><CornerDownLeft size={14} />Return</button> : null} />;
}

/* ---------- Inventory ---------- */
export function InventoryPage() {
  const { can } = useAuth(); const qc = useQueryClient(); const [item, setItem] = useState<any>(null);
  return (<>
    <ResourcePage cfg={R.inventory} renderActions={(i) => can('inventory', 'u') && <button className="btn-ghost !px-2" onClick={() => setItem(i)}><PackagePlus size={14} />Stock</button>} />
    <AnimatePresence>{item && <FormModal title={`Stock movement · ${item.name}`} onClose={() => setItem(null)} initial={{ type: 'in' }} fields={[{ name: 'type', label: 'Movement', type: 'select', options: [{ value: 'in', label: 'Stock in (purchase / return)' }, { value: 'out', label: 'Stock out (issued / used)' }], required: true, half: true }, { name: 'quantity', label: 'Quantity', type: 'number', required: true, half: true }, { name: 'note', label: 'Note' }]}
      onSubmit={async (v) => { await api.post(`/inventory/${item._id}/movement`, v); toast.ok('Stock updated'); qc.invalidateQueries({ queryKey: ['/inventory'] }); }} />}</AnimatePresence>
  </>);
}

/* ---------- Leaves ---------- */
export function LeavesPage() {
  const { user } = useAuth(); const [dec, setDec] = useState<any>(null); const qc = useQueryClient();
  const reviewer = ['owner', 'admin', 'principal', 'vice_principal', 'hr_manager'].includes(user!.role);
  const bal = useQuery({ queryKey: ['leave-balance'], queryFn: async () => (await api.get('/leaves/balance')).data });
  return (<>
    {bal.data && <p className="mb-3 text-sm opacity-70">Approved leave days used in {bal.data.year}: {Object.entries(bal.data.used).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'}</p>}
    <ResourcePage cfg={R.leaves} renderActions={(l) => reviewer && l.status === 'pending' ? <><button className="btn-ghost !px-2" onClick={() => setDec({ ...l, status: 'approved' })}><Check size={14} />Approve</button><button className="btn-ghost !px-2 text-red-700" onClick={() => setDec({ ...l, status: 'rejected' })}><X size={14} />Reject</button></> : null} />
    <AnimatePresence>{dec && <FormModal title={`${dec.status === 'approved' ? 'Approve' : 'Reject'} leave for ${dec.applicant?.name}`} submitLabel="Confirm" onClose={() => setDec(null)} fields={[{ name: 'remark', label: 'Remark (optional)', type: 'textarea' }]}
      onSubmit={async (v) => { await api.post(`/leaves/${dec._id}/decision`, { status: dec.status, remark: v.remark }); toast.ok('Decision saved'); qc.invalidateQueries({ queryKey: ['/leaves'] }); qc.invalidateQueries({ queryKey: ['leave-balance'] }); }} />}</AnimatePresence>
  </>);
}

export { dateStr };
