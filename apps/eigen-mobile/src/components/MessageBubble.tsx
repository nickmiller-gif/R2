import { StyleSheet, Text, View } from 'react-native';
import type { ChatMessage } from '../types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      {!isUser ? (
        <View style={styles.avatar}>
          <Text style={styles.avatarLabel}>R</Text>
        </View>
      ) : null}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
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
  bubble: {
    maxWidth: '82%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#1e293b',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 16,
    lineHeight: 24,
  },
  textUser: {
    color: '#f8fafc',
  },
  textAssistant: {
    color: '#f1f5f9',
  },
});
