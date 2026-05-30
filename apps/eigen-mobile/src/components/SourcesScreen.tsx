import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { labelForSourceSystem } from '../config';
import { fetchSourceInventory } from '../lib/eigenApi';
import type { SourceInventorySummary } from '../types/chat';

interface SourcesScreenProps {
  accessToken: string;
}

function SourceCard({ source }: { source: SourceInventorySummary }) {
  const label = labelForSourceSystem(source.source_system);
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{label}</Text>
        <Text style={styles.cardSystem}>{source.source_system}</Text>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{source.document_count}</Text>
          <Text style={styles.statLabel}>documents</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{source.chunk_count}</Text>
          <Text style={styles.statLabel}>chunks</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statValue}>{source.eigenx_document_count}</Text>
          <Text style={styles.statLabel}>EigenX</Text>
        </View>
      </View>
      {source.latest_updated_at ? (
        <Text style={styles.updated}>
          Updated {new Date(source.latest_updated_at).toLocaleDateString()}
        </Text>
      ) : null}
    </View>
  );
}

export function SourcesScreen({ accessToken }: SourcesScreenProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sources, setSources] = useState<SourceInventorySummary[]>([]);
  const [totals, setTotals] = useState<{ documents: number; chunks: number } | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSourceInventory(accessToken);
      setSources(data.sources.sort((a, b) => b.chunk_count - a.chunk_count));
      setTotals({ documents: data.total_documents, chunks: data.total_chunks });
      setGeneratedAt(data.generated_at);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Knowledge sources</Text>
      <Text style={styles.subtitle}>
        Indexed corpus available to EigenX chat across your R2 apps.
      </Text>

      {totals ? (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {totals.documents.toLocaleString()} documents · {totals.chunks.toLocaleString()} chunks
          </Text>
          {generatedAt ? (
            <Text style={styles.summaryHint}>
              Snapshot {new Date(generatedAt).toLocaleString()}
            </Text>
          ) : null}
        </View>
      ) : null}

      {loading ? (
        <ActivityIndicator color="#5eead4" style={styles.loader} />
      ) : error ? (
        <View style={styles.errorBox}>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void load()}>
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        sources.map((source) => <SourceCard key={source.source_system} source={source} />)
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f14',
  },
  content: {
    padding: 16,
    gap: 12,
    paddingBottom: 32,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '600',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  summary: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 4,
  },
  summaryText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '500',
  },
  summaryHint: {
    color: '#64748b',
    fontSize: 12,
  },
  loader: {
    marginTop: 24,
  },
  errorBox: {
    gap: 12,
    marginTop: 12,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
  },
  retry: {
    alignSelf: 'flex-start',
    backgroundColor: '#134e4a',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryLabel: {
    color: '#ccfbf1',
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  cardHeader: {
    gap: 2,
  },
  cardTitle: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  cardSystem: {
    color: '#64748b',
    fontSize: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  stat: {
    gap: 2,
  },
  statValue: {
    color: '#5eead4',
    fontSize: 18,
    fontWeight: '600',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  updated: {
    color: '#64748b',
    fontSize: 12,
  },
});
