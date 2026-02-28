
-- Allow anyone to view files of public spaces
CREATE POLICY "Anyone can view files of public spaces"
ON public.space_files
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.spaces
    WHERE spaces.id = space_files.space_id
    AND spaces.is_public = true
  )
);
