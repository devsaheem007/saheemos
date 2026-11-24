import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { t } from '../lib/i18n';
import { Empty, Modal, PageTitle, Skeleton } from '../components/Common';

const when = (d: string) => new Date(d).toLocaleString();
const names = (list: any[]) => (list || []).map((u) => u.name).join(', ');

function Compose({ reply, onClose, onSent }: { reply?: { to: any[]; subject: string; replyTo: string }; onClose: () => void; onSent: () => void }) {
  const [picked, setPicked] = useState<any[]>(reply?.to || []); const [q, setQ] = useState('');
  const [subject, setSubject] = useState(reply?.subject || ''); const [body, setBody] = useState(''); const [busy, setBusy] = useState(false);
  const people = useQuery({ queryKey: ['recipients', q], queryFn: async () => (await api.get('/messages/recipients', { params: { q } })).data.items });
  const send = async () => {
    setBusy(true);
    try { await api.post('/messages', { to: picked.map((p) => p._id), subject, body, replyTo: reply?.replyTo }); toast.ok(t('Sent')); onSent(); onClose(); }
    catch (e) { toast.err(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <Modal title={reply ? t('Reply') : t('New message')} onClose={onClose} wide>
      <div className="space-y-3">
        <div>
          <label className="label">{t('To')}</label>
          <div className="mb-2 flex flex-wrap gap-1.5">{picked.map((p) => <span key={p._id} className="badge flex items-center gap-1">{p.name}{!reply && <button aria-label="Remove" onClick={() => setPicked(picked.filter((x) => x._id !== p._id))}><X size={12} /></button>}</span>)}</div>
          {!reply && (<>
            <input className="input" dir="auto" placeholder={t('Search people by name')} value={q} onChange={(e) => setQ(e.target.value)} />
            <ul className="mt-1 max-h-36 overflow-y-auto rounded-lg border border-sand dark:border-charcoal">
              {(people.data || []).filter((p: any) => !picked.some((x) => x._id === p._id)).map((p: any) => (
                <li key={p._id}><button className="flex w-full justify-between px-3 py-1.5 text-start text-sm hover:bg-sand-200 dark:hover:bg-charcoal" onClick={() => setPicked([...picked, p])}><span>{p.name}</span><span className="opacity-50">{p.role.replace(/_/g, ' ')}</span></button></li>))}
            </ul></>)}
        </div>
        <div><label className="label" htmlFor="sub">{t('Message subject')}</label><input id="sub" className="input" dir="auto" value={subject} maxLength={150} onChange={(e) => setSubject(e.target.value)} /></div>
        <div><textarea className="input" dir="auto" rows={6} maxLength={5000} placeholder={t('Write your message…')} value={body} onChange={(e) => setBody(e.target.value)} aria-label={t('Message')} /></div>
        <div className="flex justify-end gap-2"><button className="btn-ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn" disabled={busy || !picked.length || !subject.trim() || !body.trim()} onClick={send}>{busy && <Loader2 size={14} className="animate-spin" />}{t('Send')}</button></div>
      </div>
    </Modal>
  );
}

function View({ id, onClose, onChange }: { id: string; onClose: () => void; onChange: () => void }) {
  const { user } = useAuth(); const [replying, setReplying] = useState(false);
  const { data, isLoading, refetch } = useQuery({ queryKey: ['message', id], queryFn: async () => (await api.get(`/messages/${id}`)).data });
  const last = data?.thread?.[data.thread.length - 1];
  const replyTo = last && (last.from._id === user!._id ? last.to : [last.from]);
  return (
    <Modal title={data?.thread?.[0]?.subject || '…'} onClose={onClose} wide>
      {isLoading ? <Skeleton rows={3} /> : (
        <div className="space-y-3">
          {data.thread.map((m: any) => (
            <div key={m._id} className="rounded-lg border border-sand p-3 dark:border-charcoal">
              <p className="text-xs opacity-60">{m.from.name} → {names(m.to)} · {when(m.createdAt)}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm" dir="auto">{m.body}</p>
            </div>))}
          <div className="flex justify-between">
            <button className="btn-ghost text-red-700" onClick={async () => { await api.delete(`/messages/${id}`); onChange(); onClose(); }}><Trash2 size={14} />{t('Delete')}</button>
            <button className="btn" onClick={() => setReplying(true)}>{t('Reply')}</button>
          </div>
        </div>)}
      <AnimatePresence>{replying && last && <Compose reply={{ to: replyTo, subject: last.subject.startsWith('Re:') ? last.subject : `Re: ${last.subject}`, replyTo: last._id }} onClose={() => setReplying(false)} onSent={() => { refetch(); onChange(); }} />}</AnimatePresence>
    </Modal>
  );
}

export default function MessagesPage() {
  const qc = useQueryClient(); const [box, setBox] = useState<'inbox' | 'sent'>('inbox'); const [composing, setComposing] = useState(false); const [open, setOpen] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['messages', box], queryFn: async () => (await api.get('/messages', { params: { box } })).data });
  const refresh = () => { qc.invalidateQueries({ queryKey: ['messages'] }); qc.invalidateQueries({ queryKey: ['msg-unread'] }); };
  return (
    <div>
      <PageTitle title="Messages" sub="Messages between you and school staff"><button className="btn" onClick={() => setComposing(true)}><Plus size={15} />{t('New message')}</button></PageTitle>
      <div className="mb-3 flex gap-1" role="tablist">{(['inbox', 'sent'] as const).map((b) => <button key={b} role="tab" aria-selected={box === b} className={box === b ? 'btn' : 'btn-ghost'} onClick={() => setBox(b)}>{t(b === 'inbox' ? 'Inbox' : 'Sent')}</button>)}</div>
      {isLoading ? <Skeleton /> : !data.items.length ? <div className="card"><Empty title="No messages yet" /></div> : (
        <ul className="card divide-y divide-sand dark:divide-charcoal">
          {data.items.map((m: any) => (
            <li key={m._id}><button className="flex w-full items-start justify-between gap-3 px-4 py-3 text-start hover:bg-sand-200 dark:hover:bg-charcoal" onClick={() => setOpen(m._id)}>
              <span className="min-w-0"><span className={`block truncate text-sm ${m.unread ? 'font-bold' : ''}`}>{m.subject}</span><span className="block truncate text-xs opacity-60" dir="auto">{box === 'inbox' ? m.from?.name : names(m.to)} · {m.snippet}</span></span>
              <span className="shrink-0 text-xs opacity-50">{new Date(m.createdAt).toLocaleDateString()}</span></button></li>))}
        </ul>)}
      <AnimatePresence>
        {composing && <Compose onClose={() => setComposing(false)} onSent={() => { setBox('sent'); refresh(); }} />}
        {open && <View id={open} onClose={() => setOpen(null)} onChange={refresh} />}
      </AnimatePresence>
    </div>
  );
}
