/**
 * EigenWidget — drop-in React component for embedding the Eigen chat widget
 * in any Lovable frontend (or any React app with Supabase auth).
 *
 * Usage:
 *   import EigenWidget from '@/components/EigenWidget';
 *   <EigenWidget siteId="hpseller" />
 *
 * Mixed mode (default): starts as public chat for anonymous visitors,
 * automatically upgrades to EigenX when the user signs in.
 */
import { useEffect, useRef, useCallback, useState } from 'react';

// ── Configuration ──────────────────────────────────────────────
// Import from your app's constants, or override via props.
// Example: import { EIGEN_WIDGET_HOST, EIGEN_API_BASE } from '@/lib/constants';

const DEFAULT_API_BASE = 'https://zudslxucibosjwefojtm.supabase.co/functions/v1';
const DEFAULT_WIDGET_HOST = 'https://eigen-d3x.pages.dev';

// ── Types ──────────────────────────────────────────────────────

type EigenMode = 'public' | 'eigenx' | 'mixed';
type LlmProvider = 'openai' | 'anthropic' | 'perplexity';

interface EigenWidgetProps {
  /** Registered site_id in eigen_site_registry */
  siteId: string;
  /** Widget mode — defaults to 'mixed' (public until sign-in) */
  mode?: EigenMode;
  /** Supabase access token (JWT). When provided, upgrades to EigenX. */
  accessToken?: string | null;
  /** R2 Supabase edge-function base URL */
  apiBase?: string;
  /** Optional default model provider for this embed */
  llmProvider?: LlmProvider;
  /** Optional model override for this embed */
  llmModel?: string;
  /** Optional context handles forwarded to widget chat */
  contextHandles?: Record<string, string | null | undefined>;
  /** Cloudflare Pages URL where the widget is hosted */
  widgetHost?: string;
  /**
   * Widget color theme. Eigen's design system is dark-only.
   * @deprecated 'light' is accepted for backward compatibility but rendered as dark; Eigen always runs in dark mode.
   */
  theme?: 'light' | 'dark';
  /** Extra CSS class on the wrapper div */
  className?: string;
  /** Inline style on the wrapper div */
  style?: React.CSSProperties;
}

// ── Component ──────────────────────────────────────────────────

export default function EigenWidget({
  siteId,
  mode = 'mixed',
  accessToken = null,
  apiBase = DEFAULT_API_BASE,
  llmProvider,
  llmModel,
  contextHandles,
  widgetHost = DEFAULT_WIDGET_HOST,
  theme = 'dark',
  className,
  style,
}: EigenWidgetProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const lastSentToken = useRef<string | null>(null);

  // Build the iframe src URL
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const src = widgetHost
    ? `${widgetHost.replace(/\/+$/, '')}/index.html?api_base=${encodeURIComponent(apiBase)}&site_id=${encodeURIComponent(siteId)}&mode=${mode}&theme=${theme}&parent_origin=${encodeURIComponent(origin)}${llmProvider ? `&llm_provider=${encodeURIComponent(llmProvider)}` : ''}${llmModel ? `&llm_model=${encodeURIComponent(llmModel)}` : ''}`
    : '';

  // Send auth token to iframe via postMessage
  const sendAuth = useCallback(
    (token: string | null) => {
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow || !widgetHost) return;
      const targetOrigin = new URL(widgetHost).origin;

      if (token) {
        iframe.contentWindow.postMessage(
          { type: 'eigen_widget_auth', authBearer: token },
          targetOrigin,
        );
      } else {
        iframe.contentWindow.postMessage(
          { type: 'eigen_widget_signout' },
          targetOrigin,
        );
      }
      lastSentToken.current = token;
    },
    [widgetHost],
  );

  // When accessToken changes, push it into the widget
  useEffect(() => {
    if (!ready) return;
    if (accessToken !== lastSentToken.current) {
      sendAuth(accessToken ?? null);
    }
  }, [accessToken, ready, sendAuth]);

  useEffect(() => {
    if (!ready || !contextHandles) return;
    const iframe = iframeRef.current;
    if (!iframe?.contentWindow || !widgetHost) return;
    const targetOrigin = new URL(widgetHost).origin;
    iframe.contentWindow.postMessage(
      { type: 'eigen_widget_context', context: contextHandles },
      targetOrigin,
    );
  }, [ready, contextHandles, widgetHost]);

  // Listen for the iframe to signal it's loaded
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (!widgetHost) return;
      const widgetOrigin = new URL(widgetHost).origin;
      if (event.origin !== widgetOrigin) return;
      if (event.data?.type === 'eigen_widget_ready') {
        setReady(true);
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [widgetHost]);

  // Fallback: mark ready when iframe loads (widget may not emit 'ready' yet)
  const onLoad = useCallback(() => {
    setReady(true);
    // Send token immediately if we have one
    if (accessToken) {
      sendAuth(accessToken);
    }
  }, [accessToken, sendAuth]);

  if (!widgetHost) {
    return (
      <div className={className} style={style}>
        <p style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
          Eigen widget not configured. Set <code>VITE_EIGEN_WIDGET_HOST</code> or
          pass <code>widgetHost</code> prop.
        </p>
      </div>
    );
  }

  return (
    <div className={className} style={style}>
      <iframe
        ref={iframeRef}
        src={src}
        onLoad={onLoad}
        title="Eigen Chat"
        allow="clipboard-write"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          minHeight: '500px',
          borderRadius: '0.75rem',
        }}
      />
    </div>
  );
}
