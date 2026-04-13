export function EigenXLogo({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="50" cy="50" r="36" stroke="#EF9F27" strokeWidth="1.5" />
      <line x1="25" y1="25" x2="75" y2="75" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="square" />
      <line x1="75" y1="25" x2="25" y2="75" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="square" />
      <circle cx="50" cy="50" r="2.5" fill="#EF9F27" />
    </svg>
  );
}
