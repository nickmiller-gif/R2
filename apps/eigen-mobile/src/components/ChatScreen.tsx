import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { sendChatMessage } from '../lib/eigenApi';
import type { ChatMessage } from '../types/chat';
import { MessageBubble } from './MessageBubble';

interface ChatScreenProps {
  accessToken: string;
  userEmail: string;
}

export function ChatScreen({ accessToken, userEmail }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `${Date.now()}-user`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const result = await sendChatMessage({
        accessToken,
        message: trimmed,
        sessionId,
        entityLabel: entityLabel.trim() || undefined,
      });

      setSessionId(result.session_id);

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: result.response,
        citations: result.citations,
        confidence: result.confidence,
        effective_policy_scope: result.effective_policy_scope,
        entity_scope_applied: result.entity_scope_applied,
        entity_scope_mode: result.entity_scope_mode,
        entity_resolution_sources: result.entity_resolution_sources,
        entity_context_count: result.entity_context_count,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [accessToken, entityLabel, input, loading, sessionId]);

  const clearChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
    >
      <View style={styles.headerMeta}>
        <Text style={styles.headerMetaText}>Signed in as {userEmail}</Text>
        <Text style={styles.headerMetaHint}>
          Ask about clients, properties, or people — MEG resolves entities automatically.
        </Text>
      </View>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>EigenX Intelligence</Text>
            <Text style={styles.emptyBody}>
              Your answers draw from MEG (clients, properties, people) and knowledge indexed from
              CentralR2, R2Works, R2Chart, R2-IP, Oracle, and your uploads.
            </Text>
          </View>
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.entityInput}
          placeholder="Focus entity (optional) — e.g. Acme Corp"
          placeholderTextColor="#64748b"
          value={entityLabel}
          onChangeText={setEntityLabel}
          editable={!loading}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message Eigen…"
            placeholderTextColor="#64748b"
            value={input}
            onChangeText={setInput}
            editable={!loading}
            multiline
            maxLength={4000}
            onSubmitEditing={() => void send()}
          />
          <Pressable
            style={[
              styles.sendButton,
              (loading || input.trim().length === 0) && styles.sendDisabled,
            ]}
            onPress={() => void send()}
            disabled={loading || input.trim().length === 0}
          >
            {loading ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.sendLabel}>Send</Text>
            )}
          </Pressable>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={clearChat} disabled={loading}>
            <Text style={styles.clearLabel}>Clear chat</Text>
          </Pressable>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f14',
  },
  headerMeta: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 4,
  },
  headerMetaText: {
    color: '#94a3b8',
    fontSize: 12,
  },
  headerMetaHint: {
    color: '#64748b',
    fontSize: 11,
    lineHeight: 16,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 48,
    gap: 10,
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '600',
  },
  emptyBody: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 21,
  },
  error: {
    color: '#fca5a5',
    fontSize: 13,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    padding: 12,
    gap: 8,
    backgroundColor: '#0a0f14',
  },
  entityInput: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#e2e8f0',
    fontSize: 13,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#f8fafc',
    fontSize: 16,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#5eead4',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 72,
    alignItems: 'center',
  },
  sendDisabled: {
    opacity: 0.5,
  },
  sendLabel: {
    color: '#0f172a',
    fontSize: 15,
    fontWeight: '600',
  },
  clearLabel: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
  },
});
