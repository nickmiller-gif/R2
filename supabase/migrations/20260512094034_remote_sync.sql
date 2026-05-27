
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reader';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'contributor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'editor';
;
