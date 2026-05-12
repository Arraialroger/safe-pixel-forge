
-- ========================================
-- PR 1: Vault hardening — limit trigger + draft state
-- ========================================

-- 1) Trigger to enforce 5 active vaults limit on PayGo (non-active subscription)
CREATE OR REPLACE FUNCTION public.enforce_vault_active_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_status text;
  active_cnt int;
BEGIN
  -- New drafts never count and are always allowed.
  IF NEW.status = 'draft' THEN
    RETURN NEW;
  END IF;

  SELECT subscription_status INTO sub_status
    FROM public.profiles
   WHERE id = NEW.owner_id;

  IF sub_status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_cnt
    FROM public.vaults
   WHERE owner_id = NEW.owner_id
     AND status IN ('pending', 'overdue');

  IF active_cnt >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 cofres ativos do plano PayGo atingido. Faça upgrade para o Plano Pro.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_vault_active_limit_trg ON public.vaults;
CREATE TRIGGER enforce_vault_active_limit_trg
  BEFORE INSERT ON public.vaults
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vault_active_limit();

-- Same trigger on UPDATE when a vault transitions from draft -> pending,
-- so frontend can't bypass the cap by inserting drafts then promoting them.
CREATE OR REPLACE FUNCTION public.enforce_vault_active_limit_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_status text;
  active_cnt int;
BEGIN
  IF NEW.status = OLD.status THEN
    RETURN NEW;
  END IF;
  -- Only enforce when transitioning into an active state from non-active.
  IF NEW.status NOT IN ('pending', 'overdue') THEN
    RETURN NEW;
  END IF;
  IF OLD.status IN ('pending', 'overdue') THEN
    RETURN NEW;
  END IF;

  SELECT subscription_status INTO sub_status
    FROM public.profiles
   WHERE id = NEW.owner_id;

  IF sub_status = 'active' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO active_cnt
    FROM public.vaults
   WHERE owner_id = NEW.owner_id
     AND id <> NEW.id
     AND status IN ('pending', 'overdue');

  IF active_cnt >= 5 THEN
    RAISE EXCEPTION 'Limite de 5 cofres ativos do plano PayGo atingido. Faça upgrade para o Plano Pro.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_vault_active_limit_upd_trg ON public.vaults;
CREATE TRIGGER enforce_vault_active_limit_upd_trg
  BEFORE UPDATE OF status ON public.vaults
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_vault_active_limit_on_update();

-- ========================================
-- PR 2: Segregate Mercado Pago tokens
-- ========================================

CREATE TABLE IF NOT EXISTS public.workspace_secrets (
  workspace_id uuid PRIMARY KEY REFERENCES public.workspaces(id) ON DELETE CASCADE,
  mp_access_token text,
  mp_refresh_token text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;

-- Block all client access. Only service_role (which bypasses RLS) can read/write.
DROP POLICY IF EXISTS "no client access" ON public.workspace_secrets;
CREATE POLICY "no client access"
  ON public.workspace_secrets
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

-- Migrate any existing tokens from workspaces -> workspace_secrets
INSERT INTO public.workspace_secrets (workspace_id, mp_access_token, mp_refresh_token)
SELECT w.id, w.mp_access_token, w.mp_refresh_token
  FROM public.workspaces w
 WHERE w.mp_access_token IS NOT NULL OR w.mp_refresh_token IS NOT NULL
ON CONFLICT (workspace_id) DO UPDATE
   SET mp_access_token = EXCLUDED.mp_access_token,
       mp_refresh_token = EXCLUDED.mp_refresh_token,
       updated_at = now();

-- Drop the now-exposed columns from workspaces
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS mp_access_token;
ALTER TABLE public.workspaces DROP COLUMN IF EXISTS mp_refresh_token;
