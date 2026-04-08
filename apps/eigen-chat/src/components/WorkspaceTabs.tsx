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
      className="flex gap-1 rounded-xl border border-border bg-elevated/80 p-1 shadow-soft"
      aria-label="Workspace"
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          title={t.hint}
          className={[
            'flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition',
            active === t.id
              ? 'bg-surface text-fg shadow-soft ring-1 ring-border'
              : 'text-muted hover:bg-surface/60 hover:text-fg',
          ].join(' ')}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}

export type { TabId };
