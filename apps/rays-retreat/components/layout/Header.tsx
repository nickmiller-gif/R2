import Link from 'next/link';

export function Header() {
  return (
    <header className="border-b border-ink/10 bg-surface-raised">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
        <Link href="/" className="font-serif text-xl font-bold text-ink hover:text-brand-600">
          Ray&apos;s Retreat
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/submit"
            className="rounded bg-brand-600 px-4 py-2 font-sans text-sm font-medium text-white hover:bg-brand-700 transition-colors"
          >
            Validate my idea
          </Link>
        </nav>
      </div>
    </header>
  );
}
