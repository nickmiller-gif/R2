DROP POLICY IF EXISTS "Authenticated can upload idea attachments" ON storage.objects;
DROP POLICY IF EXISTS "Owners can read their idea attachments" ON storage.objects;

-- Anyone can upload into the bucket; the edge function controls what gets linked to a submission.
CREATE POLICY "Anyone can upload idea attachments"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (bucket_id = 'idea-attachments');

-- No SELECT policy on storage.objects for this bucket — downloads must go through a signed URL.;
