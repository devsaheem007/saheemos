export const DEFAULT_SCALE = [
  { min: 90, grade: 'A+' }, { min: 80, grade: 'A' }, { min: 70, grade: 'B' },
  { min: 60, grade: 'C' }, { min: 50, grade: 'D' }, { min: 40, grade: 'E' }, { min: 0, grade: 'F' },
];

export function percent(marks, max) {
  if (!max || max <= 0) return 0;
  return Math.round((marks / max) * 10000) / 100;
}

export function gradeFor(marks, max, scale = DEFAULT_SCALE) {
  if (!max || max <= 0) return 'N/A';
  const pct = (marks / max) * 100;
  const sorted = [...(scale?.length ? scale : DEFAULT_SCALE)].sort((a, b) => b.min - a.min);
  for (const s of sorted) if (pct >= s.min) return s.grade;
  return sorted[sorted.length - 1].grade;
}
