
-- Add publishing fields to spaces
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false;
ALTER TABLE public.spaces ADD COLUMN IF NOT EXISTS subdomain text UNIQUE;

-- Allow anyone to view public spaces (for library page)
CREATE POLICY "Anyone can view public spaces"
ON public.spaces
FOR SELECT
USING (is_public = true);
