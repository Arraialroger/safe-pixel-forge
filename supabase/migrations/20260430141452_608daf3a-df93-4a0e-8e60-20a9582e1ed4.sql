ALTER TABLE public.vaults
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '30 days');

UPDATE public.vaults
  SET expires_at = created_at + interval '30 days'
  WHERE expires_at IS NULL;