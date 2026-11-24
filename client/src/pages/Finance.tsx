import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Bell, Printer, Receipt, Wallet, Plus } from 'lucide-react';
import { ResourcePage, ResourceConfig } from '../components/ResourcePage';
import { FormModal } from '../components/FormModal';
import { Modal, PrintSheet, SchoolLogo } from '../components/Common';
import { api, dateStr, errMsg, money, uid } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { refs } from '../lib/resources';

const cfg: ResourceConfig = {
  key: 'invoices', endpoint: '/invoices', title: 'Fee invoices', singular: 'Invoice', sub: 'Generate invoices, record payments and print receipts',
  canCreate: false, canEdit: false,
  filters: [{ name: 'status', label: 'Status', options: ['unpaid', 'partial', 'paid'] }],
  columns: [
    { key: 'number', label: 'Invoice' }, { key: 'student.name', label: 'Student' }, { key: 'title', label: 'For' },
    { key: 'dueDate', label: 'Due', render: (r) => dateStr(r.dueDate) }, { key: 'total', label: 'Total', render: (r) => money(r.total) },
    { key: 'paid', label: 'Paid', render: (r) => money(r.paid) }, { key: 'balance', label: 'Balance', render: (r) => <b>{money(r.balance)}</b> },
    { key: 'status', label: 'Status', render: (r) => <span className="badge">{r.status}</span> },
  ],
  fields: [],
};

function Receipts({ invoice, onClose }: { invoice: any; onClose: () => void }) {
  const [print, setPrint] = useState<any>(null);
  const { data, isLoading } = useQuery({ queryKey: ['inv-payments', invoice._id], queryFn: async () => (await api.get('/payments', { params: { invoice: invoice._id, limit: 100 } })).data.items });
  const { data: site } = useQuery({ queryKey: ['site'], queryFn: async () => (await api.get('/public/site')).data });
  return (
    <Modal title={`Payments for ${invoice.number}`} onClose={onClose}>
      {isLoading ? <p className="text-sm">Loading…</p> : !data?.length ? <p className="text-sm opacity-70">No payments recorded yet.</p> : (
        <ul className="divide-y divide-sand text-sm dark:divide-charcoal">
          {data.map((p: any) => (
            <li key={p._id} className="flex items-center justify-between py-2">
              <span>{p.receiptNo} · {dateStr(p.createdAt)} · {p.method}<br /><b>{money(p.amount)}</b></span>
              <button className="btn-ghost" onClick={() => setPrint(p)}><Printer size={14} />Receipt</button>
            </li>))}
        </ul>)}
      {print && (
        <PrintSheet title={`Receipt ${print.receiptNo}`} onClose={() => setPrint(null)} pdf={{ url: `/finance/receipt/${print._id}`, filename: `${print.receiptNo}.pdf` }}>
          <SchoolLogo site={site} h={48} /><h2 className="text-xl font-bold">{site?.schoolName}</h2><p>{site?.address}</p><hr className="my-3" />
          <p className="text-lg font-bold">Fee receipt {print.receiptNo}</p>
          <table className="mt-2 w-full"><tbody>
            <tr><td className="py-1 opacity-70">Date</td><td>{new Date(print.createdAt).toLocaleString()}</td></tr>
            <tr><td className="py-1 opacity-70">Student</td><td>{print.student?.name} ({print.student?.admissionNo})</td></tr>
            <tr><td className="py-1 opacity-70">Invoice</td><td>{print.invoice?.number} · {print.invoice?.title}</td></tr>
            <tr><td className="py-1 opacity-70">Method</td><td>{print.method}{print.reference ? ` · ${print.reference}` : ''}</td></tr>
            <tr><td className="py-1 opacity-70">Amount received</td><td className="text-lg font-bold">{money(print.amount)}</td></tr>
            <tr><td className="py-1 opacity-70">Invoice balance now</td><td>{money(print.invoice?.balance)}</td></tr>
          </tbody></table>
        </PrintSheet>)}
    </Modal>
  );
}

export default function Finance() {
  const { can } = useAuth(); const qc = useQueryClient();
  const [gen, setGen] = useState(false); const [pay, setPay] = useState<any>(null); const [rec, setRec] = useState<any>(null);
  const [key, setKey] = useState(uid()); // one idempotency key per payment attempt
  const summary = useQuery({ queryKey: ['fin-summary'], enabled: can('expenses', 'r'), queryFn: async () => (await api.get('/finance/summary')).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['/invoices'] }); qc.invalidateQueries({ queryKey: ['fin-summary'] }); };

  return (
    <div>
      {summary.data && (
        <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[['Collected this month', summary.data.income], ['Expenses this month', summary.data.expenses], ['Net this month', summary.data.net], ['Outstanding balance', summary.data.outstanding]].map(([l, v]: any) => (
            <div key={l} className="card p-4"><p className="text-xs font-semibold opacity-60">{l}</p><p className="font-display text-xl font-extrabold">{money(v)}</p></div>))}
        </div>)}
      <ResourcePage cfg={cfg}
        toolbar={<>
          {can('invoices', 'u') && <button className="btn-ghost" onClick={async () => { try { const { data } = await api.post('/invoices/remind'); toast.ok(`Reminders sent to ${data.notified} parent accounts${data.smsQueued ? `, ${data.smsQueued} SMS queued` : ''}`); } catch (e) { toast.err(errMsg(e)); } }}><Bell size={15} />Remind overdue</button>}
          {can('invoices', 'c') && <button className="btn" onClick={() => setGen(true)}><Plus size={15} />Generate invoices</button>}
        </>}
        renderActions={(row) => (<>
          {can('payments', 'c') && row.balance > 0 && <button className="btn-ghost !px-2" onClick={() => { setKey(uid()); setPay(row); }}><Wallet size={14} />Pay</button>}
          <button className="btn-ghost !px-2" onClick={() => setRec(row)}><Receipt size={14} />Receipts</button>
        </>)} />
      <AnimatePresence>
        {gen && <FormModal wide title="Generate invoices" submitLabel="Generate" onClose={() => setGen(false)}
          fields={[
            { name: 'title', label: 'Invoice title (e.g. November tuition)', required: true }, { name: 'period', label: 'Period (YYYY-MM)', half: true, hint: 'Prevents duplicate invoices for the same month' },
            { name: 'dueDate', label: 'Due date', type: 'date', half: true }, { name: 'class', label: 'Class (all active students)', type: 'ref', ref: refs.class, required: true },
            { name: 'feeStructures', label: 'Fee items to include', type: 'multiref', ref: { endpoint: '/fee-structures', label: (r: any) => `${r.name} – ${money(r.amount)}` }, required: true, hint: 'Hold Ctrl/Cmd to select several' },
            { name: 'discount', label: 'Discount (per student)', type: 'number', half: true }, { name: 'scholarship', label: 'Scholarship (per student)', type: 'number', half: true },
          ]}
          onSubmit={async (v) => { const { data } = await api.post('/invoices/generate', { ...v, discount: v.discount || 0, scholarship: v.scholarship || 0 }); toast.ok(`${data.created} invoices created${data.skipped ? `, ${data.skipped} skipped (already exist)` : ''}`); refresh(); }} />}
        {pay && <FormModal title={`Record payment · ${pay.number}`} submitLabel="Record payment" initial={{ amount: pay.balance, method: 'cash' }} onClose={() => setPay(null)}
          fields={[
            { name: 'amount', label: `Amount (balance ${money(pay.balance)})`, type: 'number', required: true, half: true },
            { name: 'method', label: 'Method', type: 'select', options: ['cash', 'bank', 'cheque', 'other'], required: true, half: true },
            { name: 'reference', label: 'Reference / cheque no.' },
          ]}
          onSubmit={async (v) => { const { data } = await api.post(`/invoices/${pay._id}/payments`, { ...v, idempotencyKey: key }); toast.ok(data.duplicate ? 'This payment was already recorded' : `Payment recorded · ${data.payment.receiptNo}`); refresh(); }} />}
        {rec && <Receipts invoice={rec} onClose={() => setRec(null)} />}
      </AnimatePresence>
    </div>
  );
}
