
-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Spaces table
CREATE TYPE public.space_status AS ENUM ('stopped', 'starting', 'running', 'error');

CREATE TABLE public.spaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status public.space_status NOT NULL DEFAULT 'stopped',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spaces" ON public.spaces FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own spaces" ON public.spaces FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own spaces" ON public.spaces FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own spaces" ON public.spaces FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_spaces_updated_at BEFORE UPDATE ON public.spaces
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Space files table
CREATE TABLE public.space_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  content TEXT DEFAULT '',
  is_directory BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(space_id, file_path)
);
ALTER TABLE public.space_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own files" ON public.space_files FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own files" ON public.space_files FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own files" ON public.space_files FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own files" ON public.space_files FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_space_files_updated_at BEFORE UPDATE ON public.space_files
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Script runs / terminal history
CREATE TYPE public.run_status AS ENUM ('queued', 'running', 'completed', 'failed', 'stopped');

CREATE TABLE public.script_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  space_id UUID NOT NULL REFERENCES public.spaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command TEXT NOT NULL,
  output TEXT DEFAULT '',
  status public.run_status NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.script_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own runs" ON public.script_runs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own runs" ON public.script_runs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own runs" ON public.script_runs FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for spaces and script_runs
ALTER PUBLICATION supabase_realtime ADD TABLE public.spaces;
ALTER PUBLICATION supabase_realtime ADD TABLE public.script_runs;
