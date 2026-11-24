// Turns database rows into a flat table (headers + cell values) shared by Excel and PDF exports.
const SKIP = new Set(['__v', 'passwordHash', '_id', 'updatedAt', 'academicHistory', 'documents', 'movements', 'items']);
const label = (k) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());

export function cellValue(v) {
  if (v === null || v === undefined) return '';
  if (v._bsontype === 'ObjectId' || v._bsontype === 'ObjectID') return '';
  if (v instanceof Date) return v;
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? x.name || x.title || x.registrationNo || '' : String(x))).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const named = v.name || v.title || v.registrationNo || v.code;
    return named || Object.values(v).filter((x) => typeof x === 'string' || typeof x === 'number').join(' / ');
  }
  return v;
}

export function tabulate(rows) {
  const cols = [...new Set(rows.flatMap((r) => Object.keys(r)))].filter((c) => !SKIP.has(c));
  return { cols, headers: cols.map(label), data: rows.map((r) => cols.map((c) => cellValue(r[c]))) };
}
