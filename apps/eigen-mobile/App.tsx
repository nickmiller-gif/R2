import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import type { Session } from '@supabase/supabase-js';
import { AuthScreen } from './src/components/AuthScreen';
import { ChatScreen } from './src/components/ChatScreen';
import { SourcesScreen } from './src/components/SourcesScreen';
import { supabase } from './src/lib/supabase';

type TabId = 'chat' | 'sources';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>('chat');

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
    setActiveTab('chat');
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

  const userEmail = session.user.email ?? 'member';

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <Text style={styles.brand}>Eigen</Text>
          <View style={styles.tabs}>
            <Pressable
              style={[styles.tab, activeTab === 'chat' && styles.tabActive]}
              onPress={() => setActiveTab('chat')}
            >
              <Text style={[styles.tabLabel, activeTab === 'chat' && styles.tabLabelActive]}>
                Chat
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === 'sources' && styles.tabActive]}
              onPress={() => setActiveTab('sources')}
            >
              <Text style={[styles.tabLabel, activeTab === 'sources' && styles.tabLabelActive]}>
                Sources
              </Text>
            </Pressable>
          </View>
          <Pressable onPress={() => void signOut()} hitSlop={8}>
            <Text style={styles.signOut}>Sign out</Text>
          </Pressable>
        </View>

        {activeTab === 'chat' ? (
          <ChatScreen accessToken={session.access_token} userEmail={userEmail} />
        ) : (
          <SourcesScreen accessToken={session.access_token} />
        )}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
    gap: 12,
  },
  brand: {
    color: '#f1f5f9',
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  tabs: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tabActive: {
    backgroundColor: '#134e4a',
  },
  tabLabel: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#ccfbf1',
  },
  signOut: {
    color: '#94a3b8',
    fontSize: 13,
  },
});
