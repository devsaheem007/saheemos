export function LogoMark({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="SaheemOS">
      <rect width="64" height="64" rx="14" fill="#244C3D" />
      <path d="M32 8 9 18l23 10 23-10z" fill="#EAE5D8" />
      <path d="M17 25v7c0 1 1 2 2 2" fill="none" stroke="#EAE5D8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M42 36c0-4-4-6-10-6s-10 2-10 6 4 5.5 10 7 10 3 10 7-4 6-10 6-10-2-10-6" fill="none" stroke="#FAF9F5" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false, size = 36 }: { light?: boolean; size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark size={size} />
      <span className={`font-brand text-lg font-semibold tracking-tight ${light ? 'text-ivory' : 'text-forest dark:text-sand'}`}>SaheemOS</span>
    </span>
  );
}
