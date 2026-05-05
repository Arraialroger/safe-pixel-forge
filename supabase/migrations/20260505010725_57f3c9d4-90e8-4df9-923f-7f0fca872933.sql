ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS mp_refresh_token text,
  ADD COLUMN IF NOT EXISTS mp_public_key text,
  ADD COLUMN IF NOT EXISTS mp_user_id text;