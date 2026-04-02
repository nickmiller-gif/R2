export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded border border-ink/20 bg-surface-raised px-6 py-2.5 font-sans text-sm font-medium text-ink hover:bg-surface-sunken transition-colors"
    >
      ↓ Download / Print report
    </button>
  );
}
