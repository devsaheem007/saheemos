import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'X-Requested-With': 'SaheemOS' },
});

export const errMsg = (e: any): string => {
  const d = e?.response?.data;
  if (d?.details?.length) return `${d.message}: ${d.details.map((x: any) => x.message).join(', ')}`;
  return d?.message || e?.message || 'Something went wrong';
};

export async function downloadFile(url: string, params: any, filename: string) {
  try {
    const res = await api.get(url, { params, responseType: 'blob' });
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a'); a.href = href; a.download = filename; a.click(); URL.revokeObjectURL(href);
  } catch (e: any) {
    const b = e?.response?.data;
    if (b instanceof Blob) { let msg = 'Download failed'; try { msg = JSON.parse(await b.text()).message || msg; } catch { /* not JSON */ } throw new Error(msg); }
    throw e;
  }
}
export const apiUrl = (p: string) => (import.meta.env.VITE_API_URL || '/api') + p;
export const asId = (v: any) => (v && typeof v === 'object' ? v._id : v);
export const money = (n: number | undefined | null) => (n ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
export const dateStr = (d: any) => (d ? new Date(d).toLocaleDateString() : '');
export const isoDay = (d = new Date()) => d.toISOString().slice(0, 10);
export const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(36).slice(2));
