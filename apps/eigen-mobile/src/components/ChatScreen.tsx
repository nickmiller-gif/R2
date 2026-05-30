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
}

const STARTER_PROMPTS = [
  'Who should I follow up with this week?',
  'Summarize where we stand with a client',
  'What do we know about a property?',
];

export function ChatScreen({ accessToken }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [entityLabel, setEntityLabel] = useState('');
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const send = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? input).trim();
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
        };

        setMessages((prev) => [...prev, assistantMsg]);
        requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Request failed');
      } finally {
        setLoading(false);
      }
    },
    [accessToken, entityLabel, input, loading, sessionId],
  );

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
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} />}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Text with Ray</Text>
            <Text style={styles.emptyBody}>
              Ask anything about clients, properties, or people. Answers come back the way Ray would
              write — warm, direct, and grounded in what the system knows.
            </Text>
            <View style={styles.starters}>
              {STARTER_PROMPTS.map((prompt) => (
                <Pressable
                  key={prompt}
                  style={styles.starterChip}
                  onPress={() => void send(prompt)}
                  disabled={loading}
                >
                  <Text style={styles.starterText}>{prompt}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        ListFooterComponent={
          loading ? (
            <View style={styles.typingRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>R</Text>
              </View>
              <View style={styles.typingBubble}>
                <ActivityIndicator color="#5eead4" size="small" />
              </View>
            </View>
          ) : null
        }
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.composer}>
        <TextInput
          style={styles.entityInput}
          placeholder="About someone or something? (optional)"
          placeholderTextColor="#64748b"
          value={entityLabel}
          onChangeText={setEntityLabel}
          editable={!loading}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor="#64748b"
            value={input}
            onChangeText={setInput}
            editable={!loading}
            multiline
            maxLength={4000}
          />
          <Pressable
            style={[
              styles.sendButton,
              (loading || input.trim().length === 0) && styles.sendDisabled,
            ]}
            onPress={() => void send()}
            disabled={loading || input.trim().length === 0}
          >
            <Text style={styles.sendLabel}>Send</Text>
          </Pressable>
        </View>
        {messages.length > 0 ? (
          <Pressable onPress={clearChat} disabled={loading}>
            <Text style={styles.clearLabel}>New conversation</Text>
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
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 40,
    gap: 12,
  },
  emptyTitle: {
    color: '#f1f5f9',
    fontSize: 22,
    fontWeight: '600',
  },
  emptyBody: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
  },
  starters: {
    marginTop: 8,
    gap: 8,
  },
  starterChip: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  starterText: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#134e4a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    color: '#ccfbf1',
    fontSize: 13,
    fontWeight: '600',
  },
  typingBubble: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    paddingHorizontal: 16,
    paddingVertical: 12,
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
