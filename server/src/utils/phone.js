// Normalises phone numbers to international format (+923001234567). Returns null when it cannot.
export function normalizePhone(raw, countryCode = '92') {
  if (!raw) return null;
  let p = String(raw).trim().replace(/[\s\-().]/g, '');
  if (p.startsWith('00')) p = `+${p.slice(2)}`;
  if (p.startsWith('+')) return /^\+\d{8,15}$/.test(p) ? p : null;
  if (p.startsWith('0')) p = countryCode + p.slice(1);
  else if (!p.startsWith(countryCode)) p = countryCode + p;
  return /^\d{8,15}$/.test(p) ? `+${p}` : null;
}
