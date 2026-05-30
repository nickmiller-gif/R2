import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Constants from 'expo-constants';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WebView, { type WebViewNavigation } from 'react-native-webview';

const EIGEN_CHAT_URL =
  (Constants.expoConfig?.extra?.eigenChatUrl as string | undefined)?.trim() ||
  'https://eigen-chat.pages.dev';

export default function App() {
  const webRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setLoading(true);
    webRef.current?.reload();
  }, []);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="light" />
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Could not load Eigen</Text>
            <Text style={styles.errorBody}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={reload}>
              <Text style={styles.retryLabel}>Retry</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {loading ? (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#5eead4" />
              </View>
            ) : null}
            <WebView
              ref={webRef}
              source={{ uri: EIGEN_CHAT_URL }}
              style={styles.webview}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={(event) => {
                setLoading(false);
                setError(event.nativeEvent.description || 'Network error');
              }}
              onHttpError={(event) => {
                if (event.nativeEvent.statusCode >= 400) {
                  setLoading(false);
                  setError(`HTTP ${event.nativeEvent.statusCode}`);
                }
              }}
              onNavigationStateChange={onNavigationStateChange}
              domStorageEnabled
              sharedCookiesEnabled
              thirdPartyCookiesEnabled={Platform.OS === 'android'}
              allowsBackForwardNavigationGestures={canGoBack}
              setSupportMultipleWindows={false}
              originWhitelist={['https://*', 'http://localhost:*', 'http://127.0.0.1:*']}
              applicationNameForUserAgent={`EigenMobile/0.1 (${Platform.OS})`}
            />
          </>
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0a0f14',
  },
  webview: {
    flex: 1,
    backgroundColor: '#0a0f14',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0f14',
    zIndex: 2,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  errorTitle: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '600',
  },
  errorBody: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#134e4a',
  },
  retryLabel: {
    color: '#ccfbf1',
    fontSize: 14,
    fontWeight: '600',
  },
});
