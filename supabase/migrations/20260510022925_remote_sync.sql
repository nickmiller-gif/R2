-- Expand allowed MIME types and bump size limit on the idea-attachments bucket
UPDATE storage.buckets
SET
  file_size_limit = 20971520, -- 20 MB
  allowed_mime_types = ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/csv',
    'text/plain',
    'text/markdown'
  ]
WHERE id = 'idea-attachments';

-- Tighten storage policies: only authenticated users (or service role via edge fn) may upload
DROP POLICY IF EXISTS "Anyone can upload idea attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read idea attachments" ON storage.objects;

CREATE POLICY "Authenticated can upload idea attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'idea-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Owners can read their idea attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'idea-attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

-- New table linking uploaded files to a submission
CREATE TABLE public.submission_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.idea_submissions(id) ON DELETE CASCADE,
  user_id UUID,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes >= 0 AND size_bytes <= 20971520),
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX submission_attachments_submission_idx
  ON public.submission_attachments(submission_id);

ALTER TABLE public.submission_attachments ENABLE ROW LEVEL SECURITY;

-- Owner of the submission can read their attachments
CREATE POLICY "owner reads own attachments"
ON public.submission_attachments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.idea_submissions s
    WHERE s.id = submission_attachments.submission_id
      AND s.user_id = auth.uid()
  )
);

-- Admins can read all attachments
CREATE POLICY "admin reads all attachments"
ON public.submission_attachments FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policies — writes only through the service role edge function.;
