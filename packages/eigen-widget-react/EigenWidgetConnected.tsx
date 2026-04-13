/**
 * EigenWidgetConnected — auto-wired version of EigenWidget that reads
 * the Supabase session from the app's AuthProvider (useAuth hook).
 *
 * Drop this into any Lovable app that already has AuthProvider at the root:
 *
 *   import EigenWidgetConnected from '@/components/EigenWidgetConnected';
 *   <EigenWidgetConnected siteId="hpseller" />
 *
 * It passes the access_token when signed in, and signals sign-out when not.
 */
import { useAuth } from '@/components/AuthProvider';
import EigenWidget from './EigenWidget';

interface EigenWidgetConnectedProps {
  siteId: string;
  widgetHost?: string;
  apiBase?: string;
  /**
   * Widget color theme. Eigen's design system is dark-only.
   * @deprecated 'light' is accepted for backward compatibility but rendered as dark; Eigen always runs in dark mode.
   */
  theme?: 'light' | 'dark';
  className?: string;
  style?: React.CSSProperties;
}

export default function EigenWidgetConnected({
  siteId,
  theme = 'dark',
  ...rest
}: EigenWidgetConnectedProps) {
  const { session } = useAuth();

  return (
    <EigenWidget
      siteId={siteId}
      mode="mixed"
      accessToken={session?.access_token ?? null}
      theme={theme}
      {...rest}
    />
  );
}
