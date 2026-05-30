import { StyleSheet, Text, View } from 'react-native';
import { labelForSourceSystem } from '../config';
import type { ChatCitation, ChatMessageAssistant } from '../types/chat';

interface ContextPanelProps {
  message: ChatMessageAssistant;
}

function groupCitationsByApp(citations: ChatCitation[]): Map<string, ChatCitation[]> {
  const groups = new Map<string, ChatCitation[]>();
  for (const citation of citations) {
    const sourceKey = citation.source.split(':')[0]?.trim() || citation.source;
    const label = labelForSourceSystem(sourceKey);
    const existing = groups.get(label) ?? [];
    existing.push(citation);
    groups.set(label, existing);
  }
  return groups;
}

export function ContextPanel({ message }: ContextPanelProps) {
  const entityCount = message.entity_scope_applied?.length ?? 0;
  const megContextCount = message.entity_context_count ?? 0;
  const resolutionSources = message.entity_resolution_sources ?? [];
  const policyScope = message.effective_policy_scope ?? [];
  const citations = message.citations ?? [];
  const grouped = groupCitationsByApp(citations);

  const hasMeg = entityCount > 0 || megContextCount > 0;
  const hasSources = grouped.size > 0;
  const hasPolicy = policyScope.length > 0;

  if (!hasMeg && !hasSources && !hasPolicy) {
    return null;
  }

  return (
    <View style={styles.panel}>
      {hasMeg ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MEG context</Text>
          <Text style={styles.body}>
            {entityCount > 0
              ? `${entityCount} entit${entityCount === 1 ? 'y' : 'ies'} in scope`
              : 'No entities resolved'}
            {megContextCount > 0
              ? ` · ${megContextCount} graph node${megContextCount === 1 ? '' : 's'} injected`
              : ''}
          </Text>
          {resolutionSources.length > 0 ? (
            <Text style={styles.hint}>Resolved via {resolutionSources.join(', ')}</Text>
          ) : null}
          {message.entity_scope_mode ? (
            <Text style={styles.hint}>Scope mode: {message.entity_scope_mode}</Text>
          ) : null}
        </View>
      ) : null}

      {hasPolicy ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Policy scope</Text>
          <Text style={styles.body}>{policyScope.join(' · ')}</Text>
        </View>
      ) : null}

      {hasSources ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sources used</Text>
          {[...grouped.entries()].map(([appLabel, appCitations]) => (
            <View key={appLabel} style={styles.sourceRow}>
              <Text style={styles.sourceApp}>{appLabel}</Text>
              <Text style={styles.sourceCount}>
                {appCitations.length} citation{appCitations.length === 1 ? '' : 's'}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {message.confidence ? (
        <Text style={styles.confidence}>
          Confidence: {message.confidence.overall} · {message.confidence.signals.citation_count}{' '}
          citations
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#1e293b',
    gap: 10,
  },
  section: {
    gap: 4,
  },
  sectionTitle: {
    color: '#5eead4',
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  body: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  hint: {
    color: '#64748b',
    fontSize: 12,
  },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  sourceApp: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '500',
  },
  sourceCount: {
    color: '#64748b',
    fontSize: 12,
  },
  confidence: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 2,
  },
});
