-- Harden the functions flagged by advisor 0011 (function_search_path_mutable):
-- pin an explicit search_path so resolution can't be influenced by the
-- caller's session search_path. Pinned to the schemas each function already
-- uses, so behavior is preserved (these are utility/trigger functions).
ALTER FUNCTION public.friction_zero_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.truth_market_set_updated_at() SET search_path = public, pg_catalog;
ALTER FUNCTION public.meg_catalog_to_meg_entity_type(text) SET search_path = public, pg_catalog;
ALTER FUNCTION public.platform_feed_item_is_synthetic(text, text, jsonb) SET search_path = public, pg_catalog;
ALTER FUNCTION works.trg_webhook_sources_touch() SET search_path = works, public, pg_catalog;
