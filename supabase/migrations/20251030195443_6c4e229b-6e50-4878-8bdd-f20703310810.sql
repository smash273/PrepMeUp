-- Storage RLS policies for private buckets: answer-sheets and answer-keys
-- Allow users to upload and read only their own files based on first folder = auth.uid()

-- Answer Sheets
DROP POLICY IF EXISTS "Users can upload own answer sheets" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own answer sheets" ON storage.objects;

CREATE POLICY "Users can upload own answer sheets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'answer-sheets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own answer sheets"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answer-sheets'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Answer Keys
DROP POLICY IF EXISTS "Users can upload own answer keys" ON storage.objects;
DROP POLICY IF EXISTS "Users can read own answer keys" ON storage.objects;

CREATE POLICY "Users can upload own answer keys"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'answer-keys'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can read own answer keys"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'answer-keys'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
