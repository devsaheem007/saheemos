const cell = (v) => {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') return v.name || v.title || v.code || (Array.isArray(v) ? v.length : '');
  const s = String(v);
  // Neutralise spreadsheet formula injection.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

export function toCsv(rows) {
  if (!rows.length) return '';
  const skip = new Set(['__v', 'passwordHash']);
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => !skip.has(c));
  return [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\n');
}
