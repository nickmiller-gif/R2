/**
 * Ambient shims for Deno-style URL imports used by supabase/functions/_shared/**.
 *
 * These helper modules run in the Deno edge runtime where `https://esm.sh/...`
 * imports resolve natively. When tsc (Node) pulls them in transitively via
 * a test or a src service, the URL specifier is unresolvable — so we redirect
 * the types to the npm package already installed for the same library.
 *
 * No runtime effect; this file is type-only.
 */

declare module 'https://esm.sh/@supabase/supabase-js@2' {
  export * from '@supabase/supabase-js';
}
