import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Upload } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { Modal } from './Common';
import { t as tr } from '../lib/i18n';

export type FieldType = 'text' | 'email' | 'tel' | 'number' | 'date' | 'textarea' | 'select' | 'ref' | 'multiref' | 'checkbox' | 'file' | 'lines' | 'password';
export interface Field {
  name: string; label: string; type?: FieldType; required?: boolean; options?: (string | { value: string; label: string })[];
  ref?: { endpoint: string; label: (row: any) => string; params?: Record<string, any> }; hint?: string; half?: boolean;
}

const get = (o: any, path: string) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const toInput = (f: Field, v: any) => {
  if (v == null) return f.type === 'checkbox' ? false : '';
  if (f.type === 'date') return String(v).slice(0, 10);
  if (f.type === 'ref') return typeof v === 'object' ? v._id : v;
  if (f.type === 'multiref') return (v || []).map((x: any) => (typeof x === 'object' ? x._id : x));
  if (f.type === 'lines') return (v || []).join('\n');
  return v;
};

function RefOptions({ field, register }: { field: Field; register: any }) {
  const { data, isLoading } = useQuery({
    queryKey: ['opts', field.ref!.endpoint, field.ref!.params],
    queryFn: async () => (await api.get(field.ref!.endpoint, { params: { limit: 500, ...(field.ref!.params || {}) } })).data.items,
  });
  const multi = field.type === 'multiref';
  return (
    <select className="input" multiple={multi} {...register(field.name, { required: field.required && !multi })} size={multi ? 5 : undefined}>
      {!multi && <option value="">{isLoading ? tr('Loading…') : tr('Select…')}</option>}
      {(data || []).map((row: any) => <option key={row._id} value={row._id}>{field.ref!.label(row)}</option>)}
    </select>
  );
}

function FileInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  return (
    <div className="flex items-center gap-2">
      <label className="btn-ghost cursor-pointer">
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}{value ? 'Replace file' : 'Upload file'}
        <input type="file" className="sr-only" onChange={async (e) => {
          const file = e.target.files?.[0]; if (!file) return;
          setBusy(true); setErr('');
          try { const fd = new FormData(); fd.append('file', file); const { data } = await api.post('/uploads', fd); onChange(data.url); }
          catch (x) { setErr(errMsg(x)); } finally { setBusy(false); }
        }} />
      </label>
      {value && <span className="truncate text-xs text-charcoal/60 dark:text-sand/60">{value.split('/').pop()}</span>}
      {err && <span className="text-xs text-red-600">{err}</span>}
    </div>
  );
}

export function FormModal({ title, fields, initial, submitLabel = 'Save', onSubmit, onClose, wide }: {
  title: string; fields: Field[]; initial?: any; submitLabel?: string; wide?: boolean;
  onSubmit: (values: any) => Promise<any>; onClose: () => void;
}) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<any>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');

  useEffect(() => {
    const v: any = {};
    fields.forEach((f) => setNested(v, f.name, toInput(f, get(initial, f.name))));
    reset(v);
  }, [initial]); // eslint-disable-line

  const submit = handleSubmit(async (raw) => {
    setBusy(true); setError('');
    const out: any = {};
    for (const f of fields) {
      let v = get(raw, f.name);
      if (f.type === 'number') v = v === '' || v == null ? undefined : Number(v);
      else if (f.type === 'lines') v = String(v || '').split('\n').map((s) => s.trim()).filter(Boolean);
      else if ((f.type === 'ref' || f.type === 'date' || f.type === 'select') && v === '') v = undefined;
      setNested(out, f.name, v);
    }
    try { await onSubmit(out); onClose(); } catch (e) { setError(errMsg(e)); } finally { setBusy(false); }
  });

  return (
    <Modal title={title} onClose={onClose} wide={wide}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const t = f.type || 'text';
          const full = t === 'textarea' || t === 'lines' || t === 'multiref' || t === 'file' || !f.half;
          return (
            <div key={f.name} className={full && !f.half ? 'sm:col-span-2' : ''}>
              {t !== 'checkbox' && <label className="label" htmlFor={f.name}>{tr(f.label)}{f.required && ' *'}</label>}
              {t === 'textarea' || t === 'lines' ? <textarea id={f.name} dir="auto" rows={t === 'lines' ? 4 : 3} className="input" {...register(f.name, { required: f.required })} />
                : t === 'select' ? (
                  <select id={f.name} className="input" {...register(f.name, { required: f.required })}>
                    <option value="">{tr('Select…')}</option>
                    {(f.options || []).map((o) => { const x = typeof o === 'string' ? { value: o, label: tr(o.replace(/_/g, ' ')) } : o; return <option key={x.value} value={x.value}>{x.label}</option>; })}
                  </select>)
                  : t === 'ref' || t === 'multiref' ? <RefOptions field={f} register={register} />
                  : t === 'checkbox' ? <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...register(f.name)} />{tr(f.label)}</label>
                  : t === 'file' ? <FileInput value={watch(f.name)} onChange={(v) => setValue(f.name, v)} />
                  : <input id={f.name} className="input" type={t === 'number' ? 'number' : t} step={t === 'number' ? 'any' : undefined} autoComplete="off" dir={t === 'text' ? 'auto' : 'ltr'} {...register(f.name, { required: f.required })} />}
              {f.hint && <p className="mt-1 text-xs text-charcoal/50 dark:text-sand/50">{tr(f.hint)}</p>}
              {get(errors, f.name) && <p className="mt-1 text-xs text-red-600">{tr('This field is required')}</p>}
            </div>
          );
        })}
        {error && <p className="sm:col-span-2 rounded bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300" role="alert">{error}</p>}
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn-ghost" onClick={onClose}>{tr('Cancel')}</button>
          <button className="btn" disabled={busy}>{busy && <Loader2 size={14} className="animate-spin" />}{tr(submitLabel)}</button>
        </div>
      </form>
    </Modal>
  );
}

function setNested(obj: any, path: string, value: any) {
  const keys = path.split('.');
  keys.slice(0, -1).reduce((a, k) => (a[k] = a[k] || {}), obj)[keys[keys.length - 1]] = value;
}
