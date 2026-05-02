CREATE TABLE public.vault_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_id uuid NOT NULL REFERENCES public.vaults(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('page_viewed', 'checkout_started', 'payment_approved', 'downloaded')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vault_events_vault_id_created_at_idx
  ON public.vault_events (vault_id, created_at DESC);

ALTER TABLE public.vault_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read own vault events"
  ON public.vault_events FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vaults v
    WHERE v.id = vault_events.vault_id AND v.owner_id = auth.uid()
  ));