-- Fix RLS policies for evaluations table to allow edge function to insert data
CREATE POLICY "Service can insert evaluations"
ON evaluations FOR INSERT
WITH CHECK (true);

-- Allow users to view their own evaluations (policy already exists but ensuring it's correct)
DROP POLICY IF EXISTS "Users can view own evaluations" ON evaluations;
CREATE POLICY "Users can view own evaluations"
ON evaluations FOR SELECT
USING (auth.uid() = user_id);

-- Add policy to allow updating evaluations
CREATE POLICY "Service can update evaluations"
ON evaluations FOR UPDATE
USING (true)
WITH CHECK (true);