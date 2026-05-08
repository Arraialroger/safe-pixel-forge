CREATE OR REPLACE FUNCTION public.get_achievement_data(p_vault_id uuid)
RETURNS TABLE(id uuid, title text, price numeric, paid_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT v.id, v.title, v.price,
    (SELECT MAX(e.created_at) FROM public.vault_events e
       WHERE e.vault_id = v.id AND e.event_type = 'payment_approved') AS paid_at
  FROM public.vaults v
  WHERE v.id = p_vault_id AND v.status = 'paid'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_achievement_data(uuid) TO anon, authenticated;