import { ReactNode, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence } from 'framer-motion';
import { Download, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api, errMsg, downloadFile } from '../lib/api';
import { toast, useAuth } from '../lib/store';
import { isRtl, t } from '../lib/i18n';
import { Confirm, Empty, PageTitle, Skeleton } from './Common';
import { Field, FormModal } from './FormModal';

export interface Column { key: string; label: string; render?: (row: any) => ReactNode }
export interface ResourceConfig {
  key: string; // permission key
  endpoint: string; title: string; sub?: string; singular: string;
  columns: Column[]; fields: Field[]; searchable?: boolean; filters?: { name: string; label: string; options: string[] }[];
  canCreate?: boolean; canEdit?: boolean; canDelete?: boolean;
}

export const getPath = (o: any, p: string) => p.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const show = (v: any): ReactNode => {
  if (v == null || v === '') return <span className="opacity-40">–</span>;
  if (typeof v === 'boolean') return v ? t('Yes') : t('No');
  if (/^\d{4}-\d{2}-\d{2}T/.test(String(v))) return new Date(v).toLocaleDateString();
  if (Array.isArray(v)) return v.map((x) => x?.name || x?.title || x).join(', ') || <span className="opacity-40">–</span>;
  if (typeof v === 'object') return v.name || v.title || v.registrationNo || '';
  const s = String(v).replace(/_/g, ' ');
  return s.length < 20 ? t(s) : s;
};
const noun = (s: string) => (isRtl() ? t(s) : s.toLowerCase());

export function ResourcePage({ cfg, toolbar, renderActions, extraParams }: {
  cfg: ResourceConfig; toolbar?: ReactNode; renderActions?: (row: any, reload: () => void) => ReactNode; extraParams?: Record<string, any>;
}) {
  const { can } = useAuth(); const qc = useQueryClient();
  const [page, setPage] = useState(1); const [q, setQ] = useState(''); const [filters, setFilters] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<any | null>(null); const [deleting, setDeleting] = useState<any | null>(null);
  const params = { page, limit: 15, q: q || undefined, ...filters, ...(extraParams || {}) };
  const { data, isLoading, error } = useQuery({ queryKey: [cfg.endpoint, params], queryFn: async () => (await api.get(cfg.endpoint, { params })).data });
  const reload = () => qc.invalidateQueries({ queryKey: [cfg.endpoint] });

  const allowCreate = cfg.canCreate !== false && can(cfg.key, 'c');
  const allowEdit = cfg.canEdit !== false && can(cfg.key, 'u');
  const allowDelete = cfg.canDelete !== false && can(cfg.key, 'd');

  const save = useMutation({
    mutationFn: async (v: any) => (editing?._id ? api.patch(`${cfg.endpoint}/${editing._id}`, v) : api.post(cfg.endpoint, v)),
    onSuccess: () => { toast.ok(`${t(cfg.singular)} ✓`); reload(); },
  });
  const del = useMutation({
    mutationFn: async (id: string) => api.delete(`${cfg.endpoint}/${id}`),
    onSuccess: () => { toast.ok(`${t(cfg.singular)} ✓`); setDeleting(null); reload(); },
    onError: (e) => { toast.err(errMsg(e)); setDeleting(null); },
  });

  const exportAs = async (format: 'csv' | 'xlsx' | 'pdf', el: HTMLElement) => {
    (el.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open');
    try { await downloadFile(cfg.endpoint, { ...params, page: undefined, limit: undefined, format }, `${cfg.key}.${format}`); } catch (e) { toast.err(errMsg(e)); }
  };

  return (
    <div>
      <PageTitle title={cfg.title} sub={cfg.sub}>
        {toolbar}
        <details className="relative">
          <summary className="btn-ghost cursor-pointer list-none"><Download size={15} />{t('Export')}</summary>
          <div className="absolute end-0 z-20 mt-1 w-32 rounded-lg border border-sand bg-white p-1 shadow-lg dark:border-charcoal dark:bg-charcoal-800">
            {([['csv', 'CSV'], ['xlsx', t('Excel')], ['pdf', 'PDF']] as const).map(([f, l]) => (
              <button key={f} className="block w-full rounded px-3 py-1.5 text-start text-sm hover:bg-sand-200 dark:hover:bg-charcoal" onClick={(e) => exportAs(f, e.currentTarget)}>{l}</button>))}
          </div>
        </details>
        {allowCreate && <button className="btn" onClick={() => setEditing({})}><Plus size={15} />{t('Add {x}', { x: noun(cfg.singular) })}</button>}
      </PageTitle>

      <div className="card overflow-hidden">
        {(cfg.searchable !== false || cfg.filters) && (
          <div className="flex flex-wrap gap-2 border-b border-sand p-3 dark:border-charcoal">
            {cfg.searchable !== false && (
              <div className="relative min-w-[200px] flex-1">
                <Search size={15} className="absolute start-3 top-3 opacity-40" />
                <input className="input !ps-9" dir="auto" placeholder={t('Search {x}', { x: t(cfg.title) })} value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} aria-label={t('Search')} />
              </div>)}
            {cfg.filters?.map((f) => (
              <select key={f.name} className="input !w-auto" aria-label={t(f.label)} value={filters[f.name] || ''} onChange={(e) => { setFilters({ ...filters, [f.name]: e.target.value }); setPage(1); }}>
                <option value="">{t(f.label)}: {isRtl() ? 'تمام' : 'all'}</option>{f.options.map((o) => <option key={o} value={o}>{t(o.replace(/_/g, ' '))}</option>)}
              </select>))}
          </div>)}

        {isLoading ? <Skeleton /> : error ? <Empty title="Could not load data" hint={errMsg(error)} /> : !data.items.length ? (
          <Empty title={q ? 'No matches' : t('No {x} yet', { x: t(cfg.title) })} hint={q ? 'Try a different search.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-sand-200 dark:bg-charcoal"><tr>{cfg.columns.map((c) => <th key={c.key} className="th">{t(c.label)}</th>)}<th className="th text-end">{t('Actions')}</th></tr></thead>
              <tbody>
                {data.items.map((row: any) => (
                  <tr key={row._id} className="border-t border-sand dark:border-charcoal">
                    {cfg.columns.map((c) => <td key={c.key} className="td">{c.render ? c.render(row) : show(getPath(row, c.key))}</td>)}
                    <td className="td"><div className="flex justify-end gap-1.5">
                      {renderActions?.(row, reload)}
                      {allowEdit && <button className="btn-ghost !p-1.5" onClick={() => setEditing(row)} aria-label={t('Edit')}><Pencil size={14} /></button>}
                      {allowDelete && <button className="btn-ghost !p-1.5 text-red-700" onClick={() => setDeleting(row)} aria-label={t('Delete')}><Trash2 size={14} /></button>}
                    </div></td>
                  </tr>))}
              </tbody>
            </table>
          </div>)}

        {data && data.pages > 1 && (
          <div className="flex items-center justify-between border-t border-sand p-3 text-sm dark:border-charcoal">
            <span>{t('{n} records', { n: data.total })}</span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('Previous')}</button>
              <span>{t('Page {n} of {m}', { n: page, m: data.pages })}</span>
              <button className="btn-ghost" disabled={page >= data.pages} onClick={() => setPage(page + 1)}>{t('Next')}</button>
            </div>
          </div>)}
      </div>

      <AnimatePresence>
        {editing && <FormModal wide title={editing._id ? t('Edit {x}', { x: noun(cfg.singular) }) : t('Add {x}', { x: noun(cfg.singular) })} fields={cfg.fields} initial={editing} onClose={() => setEditing(null)} onSubmit={(v) => save.mutateAsync(v)} />}
        {deleting && <Confirm text={t('Delete this {x}? This cannot be undone.', { x: noun(cfg.singular) })} busy={del.isPending} onNo={() => setDeleting(null)} onYes={() => del.mutate(deleting._id)} />}
      </AnimatePresence>
    </div>
  );
}
