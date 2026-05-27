ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'member_of';
ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'affiliated_with';
ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'controls';
ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'manages';
ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'advisor_to';
ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'investor_in';
ALTER TYPE public.meg_edge_type ADD VALUE IF NOT EXISTS 'counterparty_to';;
