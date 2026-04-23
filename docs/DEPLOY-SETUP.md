# Supabase Deploy Workflow — Setup Guide

## Overview

The `deploy.yml` workflow automatically deploys migrations and all deployable edge functions to Supabase when code is pushed to `main` (or via manual `workflow_dispatch`). It requires manual approval via a GitHub environment gate. This replaces the previous `deploy-supabase.yml` workflow, adding a CI gate before deploy.

## Step 1: Create the `production` environment

1. Go to **GitHub repo → Settings → Environments**
2. Click **New environment**, name it `production`
3. Check **Required reviewers** and add yourself (or your team)
4. Optionally set a **wait timer** (e.g., 5 minutes) for extra safety
5. Save

## Step 2: Add repository secrets

Go to **GitHub repo → Settings → Secrets and variables → Actions** and add:

| Secret                  | Value                      | Where to find it                                                                       |
| ----------------------- | -------------------------- | -------------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN` | Your personal access token | [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_PROJECT_REF`  | `zudslxucibosjwefojtm`     | Already known                                                                          |
| `SUPABASE_DB_PASSWORD`  | Your database password     | Supabase Dashboard → Project Settings → Database                                       |

## Step 3: Test the workflow

1. Create a branch, make a trivial change (e.g., add a comment to a migration)
2. Open a PR → CI runs
3. Merge to `main` → deploy workflow triggers
4. You'll get a notification to approve the `production` environment
5. Approve → migrations and functions deploy
6. Check the **Actions** tab for the deploy summary

## How it works

```
Push to main
  └─ deploy.yml triggers
       ├─ ci job (reuses ci.yml — typecheck, test, guards)
       └─ deploy job (needs: ci, environment: production)
            ├─ supabase link
            ├─ supabase db push (migrations)
            └─ supabase functions deploy (all deployable functions)
```

## Edge function deploy flags

- `--no-verify-jwt` is only set for widget-facing public functions (`eigen-widget-session`, `eigen-widget-chat`).
- All other functions are deployed with gateway JWT verification enabled.

## Rollback

- **Migrations:** Supabase migrations are forward-only. To fix a bad migration, add a new corrective migration.
- **Edge functions:** Revert the commit on `main` and re-deploy. The workflow will push the previous function code.
