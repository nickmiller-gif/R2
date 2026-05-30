import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { supabase } from '../lib/supabase';
import { SUPABASE_ANON_KEY } from '../config';

interface AuthScreenProps {
  onSignedIn: () => void;
}

export function AuthScreen({ onSignedIn }: AuthScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const missingConfig = SUPABASE_ANON_KEY.length === 0;

  const signIn = async () => {
    if (missingConfig) {
      setError('Set EXPO_PUBLIC_SUPABASE_ANON_KEY in .env and restart Expo.');
      return;
    }
    const trimmedEmail = email.trim();
    if (!trimmedEmail || password.length === 0) {
      setError('Enter email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: trimmedEmail,
      password,
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }
    onSignedIn();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Text style={styles.title}>EigenX</Text>
        <Text style={styles.subtitle}>
          Sign in to chat with your MEG graph and knowledge across R2 apps.
        </Text>

        {missingConfig ? (
          <View style={styles.configWarning}>
            <Text style={styles.configWarningText}>
              Missing Supabase anon key. Copy .env.example to .env and set
              EXPO_PUBLIC_SUPABASE_ANON_KEY.
            </Text>
          </View>
        ) : null}

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#64748b"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          value={email}
          onChangeText={setEmail}
          editable={!loading}
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#64748b"
          secureTextEntry
          textContentType="password"
          value={password}
          onChangeText={setPassword}
          editable={!loading}
          onSubmitEditing={() => void signIn()}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={() => void signIn()}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#0f172a" />
          ) : (
            <Text style={styles.buttonLabel}>Sign in</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0f14',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    gap: 14,
  },
  title: {
    color: '#f1f5f9',
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
  configWarning: {
    backgroundColor: '#422006',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#92400e',
  },
  configWarningText: {
    color: '#fde68a',
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f8fafc',
    fontSize: 16,
  },
  error: {
    color: '#fca5a5',
    fontSize: 14,
  },
  button: {
    marginTop: 4,
    backgroundColor: '#5eead4',
    borderRadius: 999,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonLabel: {
    color: '#0f172a',
    fontSize: 16,
    fontWeight: '600',
  },
});
