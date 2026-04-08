# Eigen iframe widget (Phase 1)

Recommended host: **Cloudflare Pages** (see `docs/eigen-widget-hosting-cloudflare-pages.md`).

Host `apps/eigen-widget` on a static origin and embed with:

```html
<iframe
  src="https://<widget-host>/index.html?api_base=https://zudslxucibosjwefojtm.supabase.co/functions/v1&site_id=<site_id>&mode=public"
  title="Eigen Chat"
  style="width: 100%; max-width: 420px; height: 620px; border: 0;"
  loading="lazy"
></iframe>
```

For EigenX mode:

```html
<iframe id="eigenx-frame" src="https://<widget-host>/index.html?api_base=https://zudslxucibosjwefojtm.supabase.co/functions/v1&site_id=<site_id>&mode=eigenx"></iframe>
<script>
  const frame = document.getElementById('eigenx-frame');
  // authBearer is your logged-in user access token from shared Supabase auth.
  frame.contentWindow.postMessage({ type: 'eigen_widget_auth', authBearer }, '*');
</script>
```

Notes:

- `mode=public` uses anonymous widget sessions and `eigen_public` policy scope.
- `mode=eigenx` requires valid auth and site registry permission in `eigen-widget-session`.
