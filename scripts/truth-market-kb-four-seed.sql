-- Optional smoke seed for Truth Market KB-four exit gate (run on Eigen after migration apply).
-- Requires existing platform_feed_items per source_system; uses truth_market_promote_feed_cluster.

-- Example (operator session or service role):
-- SELECT public.truth_market_promote_feed_cluster('centralr2', 3);
-- SELECT public.truth_market_promote_feed_cluster('operator_workbench', 3);
-- SELECT public.truth_market_promote_feed_cluster('r2chart', 3);
-- SELECT public.truth_market_promote_feed_cluster('ip_pulse_point', 3);

-- Verify:
-- SELECT source_system, count(*) FROM public.platform_feed_items
-- WHERE source_system IN ('centralr2','operator_workbench','r2chart','ip_pulse_point')
-- GROUP BY 1;
-- SELECT id, title, status FROM public.missing_institution_briefs ORDER BY created_at DESC LIMIT 10;
