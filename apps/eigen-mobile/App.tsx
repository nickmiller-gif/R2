import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './src/components/AuthScreen';
import { ChatScreen } from './src/components/ChatScreen';
import { supabase } from './src/lib/supabase';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  if (booting) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color="#5eead4" />
      </View>
    );
  }

  if (!session?.access_token) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right', 'bottom']}>
          <StatusBar style="light" />
          <AuthScreen onSignedIn={() => {}} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>Ray</Text>
            <Text style={styles.tagline}>EigenX · clients · properties · people</Text>
          </View>
          <Pressable onPress={() => void signOut()} hitSlop={8}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>
        <ChatScreen accessToken={session.access_token} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: '#0a0f14',
    alignItems: 'center',
    justifyContent: 'center',
  },
  safe: {
    flex: 1,
    backgroundColor: '#0a0f14',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  brand: {
    color: '#f1f5f9',
    fontSize: 20,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  tagline: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  signOut: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
