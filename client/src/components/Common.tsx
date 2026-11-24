import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useToasts, toast } from '../lib/store';
import { apiUrl, downloadFile, errMsg } from '../lib/api';
import { t, useLang } from '../lib/i18n';

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-charcoal-900/50 p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div role="dialog" aria-modal="true" aria-label={t(title)} initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`card max-h-[92vh] w-full overflow-y-auto p-5 ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{t(title)}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

export function Confirm({ text, onYes, onNo, busy }: { text: string; onYes: () => void; onNo: () => void; busy?: boolean }) {
  return (
    <Modal title="Please confirm" onClose={onNo}>
      <p className="mb-5 text-sm">{text}</p>
      <div className="flex justify-end gap-2">
        <button className="btn-ghost" onClick={onNo}>{t('Cancel')}</button>
        <button className="btn-danger" onClick={onYes} disabled={busy}>{busy && <Loader2 className="animate-spin" size={14} />}{t('Confirm')}</button>
      </div>
    </Modal>
  );
}

export const SchoolLogo = ({ site, h = 40 }: { site: any; h?: number }) =>
  site?.logo ? <img src={apiUrl(site.logo)} alt={`${site.schoolName || 'School'} logo`} style={{ height: h }} className="mb-2 w-auto object-contain" /> : null;

export const Skeleton = ({ rows = 5 }: { rows?: number }) => (
  <div className="animate-pulse space-y-2 p-4" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }).map((_, i) => <div key={i} className="h-8 rounded bg-sand dark:bg-charcoal" />)}
  </div>
);

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="px-6 py-12 text-center">
    <p className="font-display font-bold">{t(title)}</p>
    {hint && <p className="mt-1 text-sm text-charcoal/60 dark:text-sand/60">{t(hint)}</p>}
  </div>
);

export const PageTitle = ({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) => (
  <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight">{t(title)}</h1>
      {sub && <p className="text-sm text-charcoal/60 dark:text-sand/60">{t(sub)}</p>}
    </div>
    <div className="flex flex-wrap gap-2">{children}</div>
  </div>
);

export function Toasts() {
  const { items, drop } = useToasts();
  return (
    <div className="no-print fixed bottom-4 end-4 z-[60] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div key={t.id} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} onClick={() => drop(t.id)}
            className={`cursor-pointer rounded-lg px-4 py-3 text-sm font-medium shadow-lg ${t.kind === 'ok' ? 'bg-forest text-ivory' : 'bg-red-700 text-white'}`}>{t.msg}</motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PrintSheet({ title, onClose, children, pdf }: { title: string; onClose: () => void; children: ReactNode; pdf?: { url: string; filename: string; params?: any } }) {
  return (
    <Modal title={title} onClose={onClose} wide>
      <div className="no-print mb-3 flex justify-end gap-2">
        {pdf && <button className="btn-ghost" onClick={() => downloadFile(pdf.url, pdf.params ?? { format: 'pdf' }, pdf.filename).catch((e) => toast.err(errMsg(e)))}>{t('Download PDF')}</button>}
        <button className="btn" onClick={() => window.print()}>{t('Print')}</button>
      </div>
      <div className="print-area rounded-lg border border-sand p-5 text-sm dark:border-charcoal">{children}</div>
    </Modal>
  );
}

export function LangToggle() {
  const { lang, set } = useLang();
  return <button className="btn-ghost !px-2.5 text-xs" onClick={() => set(lang === 'ur' ? 'en' : 'ur')} aria-label="Language">{lang === 'ur' ? 'English' : 'اردو'}</button>;
}
