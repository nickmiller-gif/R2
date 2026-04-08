# Eigen Widget Hosting (Cloudflare Pages)

This is the default/recommended host for the website chatbot frontend in this repo.

## Why Cloudflare Pages

- Static asset deploy from `apps/eigen-widget` with zero backend runtime.
- Global edge delivery and low latency.
- Easy custom domain (`widget.<your-domain>`).
- Works well with iframe embeds used by the Phase 1 rollout.

## 1) Create the Pages project

1. In Cloudflare Pages, create a project for this repository.
2. You can skip framework build and deploy static files directly from `apps/eigen-widget`.
3. Set your production custom domain (for example `widget.yourdomain.com`).

## 2) Configure GitHub secrets

In GitHub repo secrets, add:

- `CLOUDFLARE_API_TOKEN` (Pages deploy permission)
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_PAGES_PROJECT_EIGEN_WIDGET` (exact Pages project name)

The workflow file is:

- `.github/workflows/deploy-widget-cloudflare.yml`

It deploys automatically on pushes to `main` when files under `apps/eigen-widget/**` change.

## 3) Register widget site in Supabase

Create an `eigen_site_registry` row for each website using the widget:

- `site_id` (stable key per site)
- `origins` (must include your website origin and widget origin policy as needed)
- `mode` (`public`, `eigenx`, or `mixed`)
- `source_systems` (site-preferred corpora)
- `default_policy_scope` (`["eigen_public"]` for public mode; include `eigenx` for private mode)
- `status = active`

## 4) Embed snippet

Use the hosted widget URL:

```html
<iframe
  src="https://widget.yourdomain.com/index.html?api_base=https://zudslxucibosjwefojtm.supabase.co/functions/v1&site_id=your-site-id&mode=public"
  title="Eigen Chat"
  style="width:100%;max-width:420px;height:620px;border:0"
  loading="lazy"
></iframe>
```

For private EigenX mode:

- Use `mode=eigenx`.
- Parent page posts user bearer token to iframe (`eigen_widget_auth` message).
- `eigen-widget-session` validates origin/site and member role before issuing session token.

## 5) Required Supabase environment

- `EIGEN_WIDGET_SESSION_SECRET`
- `OPENAI_API_KEY`
- `OPENAI_CHAT_MODEL` (optional override)
- Public/eigenx prompt and rate-limit envs as configured in prior rollout steps.
