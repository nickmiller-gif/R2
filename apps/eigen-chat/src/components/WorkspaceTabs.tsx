type TabId = 'chat' | 'ingest' | 'sources';

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: 'chat', label: 'Chat', hint: 'Ask questions' },
  { id: 'ingest', label: 'Ingest', hint: 'Add documents' },
  { id: 'sources', label: 'Sources', hint: 'Corpus inventory' },
];

export function WorkspaceTabs({
  active,
  onChange,
}: {
  active: TabId;
  onChange: (tab: TabId) => void;
}) {
  return (
    <nav
      className="flex gap-1 rounded-card border border-border bg-surface p-1"
      aria-label="Workspace"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          title={t.hint}
          className={[
            'flex-1 rounded-[10px] px-4 py-2.5 text-label uppercase tracking-label transition',
            active === t.id
              ? 'border border-border-hover bg-elevated text-accent'
              : 'border border-transparent text-muted hover:text-fg',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export type { TabId };
