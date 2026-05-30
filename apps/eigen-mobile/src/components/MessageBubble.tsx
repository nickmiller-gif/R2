import { StyleSheet, Text, View } from 'react-native';
import { ContextPanel } from './ContextPanel';
import type { ChatMessage } from '../types/chat';

interface MessageBubbleProps {
  message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <View style={[styles.row, isUser ? styles.rowUser : styles.rowAssistant]}>
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleAssistant]}>
        <Text style={[styles.text, isUser ? styles.textUser : styles.textAssistant]}>
          {message.content}
        </Text>
        {message.role === 'assistant' ? <ContextPanel message={message} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    marginBottom: 12,
    flexDirection: 'row',
  },
  rowUser: {
    justifyContent: 'flex-end',
  },
  rowAssistant: {
    justifyContent: 'flex-start',
  },
  bubble: {
    maxWidth: '92%',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleUser: {
    backgroundColor: '#134e4a',
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  textUser: {
    color: '#ecfdf5',
  },
  textAssistant: {
    color: '#f1f5f9',
  },
});
