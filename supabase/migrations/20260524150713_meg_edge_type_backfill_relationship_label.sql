UPDATE public.meg_entity_edges
SET edge_type = (metadata->>'relationship_label')::public.meg_edge_type
WHERE edge_type = 'related_to'
  AND metadata->>'relationship_label' IN (
    'member_of',
    'affiliated_with',
    'controls',
    'manages',
    'advisor_to',
    'investor_in',
    'counterparty_to'
  );;
