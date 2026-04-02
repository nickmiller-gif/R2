export default function Loading() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" aria-label="Loading" />
    </div>
  );
}
