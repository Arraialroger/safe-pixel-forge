CREATE TABLE public.oauth_states (
  nonce uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_oauth_states_expires_at ON public.oauth_states(expires_at);
CREATE INDEX idx_oauth_states_owner_id ON public.oauth_states(owner_id);

ALTER TABLE public.oauth_states ENABLE ROW LEVEL SECURITY;

CREATE POLICY "no client access" ON public.oauth_states
  AS PERMISSIVE FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);