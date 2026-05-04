-- 1) Drop public read policy on vaults
DROP POLICY IF EXISTS "Public can read vaults" ON public.vaults;

-- 2) Create SECURITY DEFINER RPC returning only safe fields
CREATE OR REPLACE FUNCTION public.get_public_vault_by_slug(_slug text)
RETURNS TABLE (
  id uuid,
  title text,
  client_name text,
  price numeric,
  status text,
  public_slug text,
  file_name text,
  owner_id uuid,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    v.id,
    v.title,
    v.client_name,
    v.price,
    v.status,
    v.public_slug,
    v.file_name,
    v.owner_id,
    v.expires_at
  FROM public.vaults v
  WHERE v.public_slug = _slug
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_vault_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_vault_by_slug(text) TO anon, authenticated;

-- 3) Harden handle_new_user with explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);

  INSERT INTO public.workspaces (owner_id)
  VALUES (new.id);

  RETURN new;
END;
$function$;