## Fase 15 — Motor de Aquisição Viral (PLG)

### 1. Ajuste Zod (NewVaultDialog.tsx)
O schema já exige `> 0` e `allowed_payment_methods` é `z.enum(["pix","all"])`. Reforçar:
- Trocar `.refine(parseBRLToNumber(v) > 0)` por `.refine((v) => parseBRLToNumber(v) >= 0.5, "Valor mínimo R$ 0,50.")` (evita centavos zerados que travariam no MP).
- Remover o `.default("pix")` do enum (já vem do `defaultValues`) e garantir que o enum não aceita `undefined` — tornando o campo realmente obrigatório no submit.

### 2. Edge Function `get-owner-branding` — flag `is_pro`
- Adicionar `subscription_status` ao SELECT de `profiles`.
- Retornar também `is_pro: subscription_status === 'active'`.
- Sem mudança de contrato quebrando: campos novos, retrocompatível.

Atualizar `usePublicOwnerBranding` em `src/hooks/useBranding.ts` para expor `isPro: boolean`.

### 3. Rodapé PLG no `PayVault.tsx`
- Substituir a linha atual `"Protegido por PixelSafe"` por um componente `CheckoutFooter` que recebe `ownerId`.
- Usa `usePublicOwnerBranding(ownerId).isPro`:
  - `!isPro` → texto "Receba seus pagamentos com segurança — PixelSafe" + link discreto "Você é freelancer? Crie sua conta grátis." → `/?ref=checkout_footer`.
  - `isPro` → mantém apenas "Protegido por PixelSafe".
- Estilo discreto, `text-xs text-muted-foreground`, link com `underline-offset` sutil.

### 4. Migration: RPC `get_achievement_data`
```sql
CREATE OR REPLACE FUNCTION public.get_achievement_data(p_vault_id uuid)
RETURNS TABLE(id uuid, title text, price numeric, paid_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.id, v.title, v.price,
    (SELECT MAX(e.created_at) FROM vault_events e
       WHERE e.vault_id = v.id AND e.event_type = 'payment_approved') AS paid_at
  FROM vaults v
  WHERE v.id = p_vault_id AND v.status = 'paid'
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_achievement_data(uuid) TO anon, authenticated;
```
Retorna apenas `id`, `title`, `price`, `paid_at`. Nunca expõe cliente, e-mail, whatsapp, file_path. Filtro `status = 'paid'` impede vazamento de cofres pendentes.

### 5. Nova rota pública `/conquista/:id`
- Criar `src/pages/Achievement.tsx`:
  - `useQuery` chamando `supabase.rpc("get_achievement_data", { p_vault_id: id })`.
  - Estados: loading skeleton; not-found → card de erro elegante; sucesso → tela de conquista.
- UI mobile-first, fundo escuro (`bg-gradient-to-b from-background to-vault/10`), troféu (lucide `Trophy`) com confete sutil (CSS), título do projeto, bloco grande com `formatBRL(price)` em verde (`text-success`).
- Botões:
  - "Compartilhar no WhatsApp" → `https://wa.me/?text=...` com texto pré-pronto incluindo o link `/conquista/:id`.
  - "Copiar link" → `navigator.clipboard.writeText(window.location.href)` + toast.
- CTA final: "Comece a receber pelos seus projetos com segurança no PixelSafe" → `/?ref=achievement`.
- Registrar a rota em `src/App.tsx` **fora** do `AuthenticatedLayout`, antes do catch-all.

### 6. E-mail rico pós-pagamento (`mp-webhook`)
- Sem mexer em concorrência/travas. Apenas no HTML do e-mail enviado ao **owner** (segundo `sendResendEmail`):
  - Bloco de destaque: `background:#064e3b; color:#a7f3d0; padding:18px; border-radius:10px; font-size:22px; font-weight:700;` mostrando "💰 Você recebeu {priceStr}".
  - Manter tabela de detalhes (cliente, cofre).
  - Adicionar **segundo CTA secundário** abaixo do "Ver no Dashboard": link estilizado como botão outline → `${PUBLIC_APP_URL}/conquista/${vaultId}` com label "Compartilhar conquista 🏆".
- Para suportar múltiplos CTAs, estender `_shared/resend.ts`:
  - Adicionar campo opcional `secondaryCtaLabel?: string; secondaryCtaUrl?: string;` ao `SendEmailParams` e renderizar em `buildLayout` (botão outline cinza abaixo do CTA principal).
  - Mudança retrocompatível — outros callers continuam funcionando.

### 7. Documentação `docs/TECH_SPEC.md`
- Nova seção **Fase 15 — Aquisição Viral (PLG)**:
  - `get-owner-branding` agora expõe `is_pro`.
  - Rodapé condicional no checkout (`PayVault`) com upsell para não-Pro.
  - RPC `get_achievement_data` (campos retornados, política de privacidade — não expõe PII, exige `status = 'paid'`).
  - Rota pública `/conquista/:id` e fluxo de compartilhamento.
  - E-mail do owner com bloco de valor em destaque + CTA "Compartilhar conquista".

### Arquivos afetados
- `src/components/NewVaultDialog.tsx` (Zod)
- `supabase/functions/get-owner-branding/index.ts`
- `src/hooks/useBranding.ts`
- `src/pages/PayVault.tsx`
- migration SQL (nova)
- `src/pages/Achievement.tsx` (novo)
- `src/App.tsx`
- `supabase/functions/mp-webhook/index.ts`
- `supabase/functions/_shared/resend.ts`
- `docs/TECH_SPEC.md`

### Fora de escopo
- Nada de tracking do parâmetro `?ref=` na landing (apenas anexar o param ao link; analytics pode vir depois).
- Sem alterar rate limiting, RLS de outras tabelas, ou lógica do webhook além do HTML.
