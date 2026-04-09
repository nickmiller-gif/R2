# Eigen Widget — Lovable App Integration Guide

Deploy the Eigen chat widget on any Lovable frontend with mixed mode: public chat for anonymous visitors, EigenX (authenticated, policy-scoped) for signed-in users.

## Architecture

```
Lovable App (hpseller.lovable.app)
  └─ <iframe> → Eigen Widget (Cloudflare Pages)
       └─ calls → R2 Supabase Edge Functions (zudslxucibosjwefojtm)
            └─ reads → knowledge_chunks (vector search + policy scope)
```

Each Lovable app has its own Supabase project for auth/data, but Eigen's retrieval runs against the R2 Supabase project. The widget iframe bridges this — the parent app passes its auth token via `postMessage`, and the widget uses that token to request an eigenx-scoped session from R2.

## Prerequisites

- Eigen widget deployed to Cloudflare Pages (workflow: `deploy-widget-cloudflare.yml`)
- R2 Supabase edge functions deployed (eigen-widget-session, eigen-widget-chat, eigen-retrieve, etc.)
- Site registered in `eigen_site_registry` (migration `202604080010`)

## Step 1 — Copy the React component

Copy these two files into each Lovable app's `src/components/eigen/` directory:

```
packages/eigen-widget-react/EigenWidget.tsx        → src/components/eigen/EigenWidget.tsx
packages/eigen-widget-react/EigenWidgetConnected.tsx → src/components/eigen/EigenWidgetConnected.tsx
```

Update the import path in `EigenWidgetConnected.tsx`:
```ts
import EigenWidget from './EigenWidget';  // same directory
```

## Step 2 — Add environment variables

In each Lovable app's `.env` (or Lovable's env settings):

```env
VITE_EIGEN_WIDGET_HOST=https://<your-widget-cloudflare-url>
VITE_EIGEN_API_BASE=https://zudslxucibosjwefojtm.supabase.co/functions/v1
```

## Step 3 — Embed the widget

In any page or layout component:

```tsx
import EigenWidgetConnected from '@/components/eigen/EigenWidgetConnected';

export default function SomePage() {
  return (
    <div>
      {/* Your page content */}
      <EigenWidgetConnected siteId="hpseller" />
    </div>
  );
}
```

That's it. The component reads the auth session from your existing `AuthProvider` and automatically:
- Starts in public mode (no login needed)
- Upgrades to EigenX when the user signs in
- Downgrades back to public on sign-out

### Manual control (without AuthProvider)

If you need manual token management:

```tsx
import EigenWidget from '@/components/eigen/EigenWidget';

<EigenWidget
  siteId="hpseller"
  mode="mixed"
  accessToken={myToken}
  widgetHost="https://eigen-widget.pages.dev"
  apiBase="https://zudslxucibosjwefojtm.supabase.co/functions/v1"
/>
```

## Step 4 — Register the site (already done)

Migration `202604080010_eigen_site_registry_lovable_apps.sql` registers all four apps:

| site_id | origins | mode |
|---------|---------|------|
| r2app | r2app.lovable.app, localhost:5173/8080 | mixed |
| hpseller | hpseller.lovable.app, localhost:5173/8080 | mixed |
| ip-insights-hub | ip-insights-hub.lovable.app, localhost:5173/8080 | mixed |
| centralr2-core | centralr2-core.lovable.app, localhost:5173/8080 | mixed |

**Custom domains**: if any app uses a custom domain, add it to the `origins` array:
```sql
UPDATE eigen_site_registry
SET origins = origins || '["https://mycustomdomain.com"]'::jsonb,
    updated_at = now()
WHERE site_id = 'hpseller';
```

## Step 5 — Ingest content

### Option A: Drop files in the knowledge directory

Put `.md`, `.txt`, `.csv`, `.pdf`, or `.docx` files into:
```
knowledge/<site_id>/
```

Then run:
```bash
export SUPABASE_URL=https://zudslxucibosjwefojtm.supabase.co
export AUTH_BEARER=<member-jwt>
./scripts/eigen-ingest-all-sites.sh hpseller
```

### Option B: Configure sitemap/RSS crawling

Edit `config/eigen-sites.json` to add URLs:
```json
{
  "hpseller": {
    "sitemaps": ["https://hpseller.lovable.app/sitemap.xml"],
    "rss_feeds": ["https://hpseller.lovable.app/blog/rss.xml"],
    "fetch_allowlist": ["hpseller.lovable.app"]
  }
}
```

Then add the domain to the edge function's fetch allowlist:
```
# In Supabase Dashboard → Edge Functions → eigen-fetch-ingest → Secrets
EIGEN_FETCH_ALLOWLIST=hpseller.lovable.app,r2app.lovable.app,...
```

### Option C: GitHub Actions (automated)

The existing `eigen-public-corpus.yml` workflow runs weekly. Update its variables to include your site's sitemaps/feeds, or create a new workflow that calls `eigen-ingest-all-sites.sh`.

## Step 6 — Verify

1. Open your Lovable app in the browser
2. The Eigen launcher button (blue circle, bottom-right) should appear
3. Click it → type a question → should get a response from the public corpus
4. Sign in → the widget header should switch from "Public Eigen" to "EigenX"
5. Ask a question → should get results from the eigenx-scoped corpus

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| "Origin not allowed for site" | App's domain not in `eigen_site_registry.origins` |
| "Unknown site_id" | Migration not applied or site_id mismatch |
| Widget doesn't appear | `VITE_EIGEN_WIDGET_HOST` not set or widget not deployed |
| "No response generated" | `OPENAI_API_KEY` not set in R2 Supabase edge function secrets |
| Public mode works but EigenX fails | User doesn't have `member` role in R2's `charter_user_roles` |
| Low confidence / no citations | No content ingested yet for this site's policy scope |

## Files created/modified

```
apps/eigen-widget/widget.js                          — Mixed mode support (public↔eigenx)
packages/eigen-widget-react/EigenWidget.tsx           — Reusable React component
packages/eigen-widget-react/EigenWidgetConnected.tsx  — Auth-aware wrapper (useAuth)
supabase/migrations/202604080010_...lovable_apps.sql  — Site registry entries
config/eigen-sites.json                               — Per-site ingestion config
knowledge/{r2app,hpseller,ip-insights-hub,centralr2-core}/  — Content directories
scripts/eigen-ingest-all-sites.sh                     — Multi-site ingestion runner
docs/eigen-lovable-integration.md                     — This guide
```
