## Avaliação da abordagem

Concordo 100% com o redesenho. O card atual realmente parece um paywall e oculta o fato de que o usuário já está ativo no PayGo. Trazer o cancelamento para dentro do app reduz fricção e churn (evita que o usuário abandone porque "não achou onde cancelar"). Tenho **3 sugestões pontuais de UX** que recomendo incorporar:

1. **AlertDialog de cancelamento com fricção certa** — usar uma cópia que reforce o que ele *perde* e o que *mantém* (ex.: "Você voltará ao plano PayGo. Continuará podendo vender, mas a taxa de 2,9% por venda voltará a ser cobrada."). Isso evita arrependimento e suporte.
2. **Estado `overdue` (atraso)** — manter o tratamento atual (badge âmbar + botão "Pagar fatura") dentro do mesmo card refatorado, para não regredir a Fase 8. O cancelamento só aparece quando `isActive` (Asaas só permite cancelar assinatura ativa de forma limpa).
3. **Loading otimista no cancelamento** — desabilitar o botão e mostrar `Loader2` enquanto a edge function roda; após sucesso, `refetch()` da `useSubscription` + invalidate `["subscription", userId]`.

Tudo o mais segue exatamente como você pediu.

---

## Plano de execução

### 1. Edge Function `cancel-subscription` (nova)

Arquivo: `supabase/functions/cancel-subscription/index.ts`. Não exige alteração em `supabase/config.toml` (default `verify_jwt = false` na infra atual; validamos o JWT em código com `getClaims`, padrão já usado em `asaas-checkout`).

Fluxo:
1. `OPTIONS` → CORS.
2. Valida `Authorization: Bearer ...` via `supabase.auth.getClaims(token)`. Sem claims → 401.
3. Cria client `admin` com `SERVICE_ROLE_KEY`.
4. `SELECT asaas_subscription_id, subscription_status FROM profiles WHERE id = userId`.
5. Se `asaas_subscription_id` for null → `400 { error: "Sem assinatura ativa para cancelar." }`.
6. `DELETE {asaasBaseUrl()}/subscriptions/{id}` com header `access_token: ASAAS_API_KEY`. Reaproveita o helper `asaasBaseUrl()` (sandbox/prod via `ASAAS_ENV`) — copiamos a função do `asaas-checkout`.
7. Trata `404` do Asaas como sucesso idempotente (assinatura já cancelada lá).
8. `UPDATE profiles SET subscription_status = 'inactive' WHERE id = userId` (mantém `asaas_subscription_id` para histórico/auditoria — não apagamos para fins de log).
9. Retorna `{ success: true }`. Falhas inesperadas → 500 com log no console.

Observação: o `asaas-webhook` já lida com `SUBSCRIPTION_DELETED` (Fase 8). Mesmo que ele chegue depois e tente atualizar para `inactive`, é idempotente. Sem efeito colateral.

### 2. Refatoração do `PlanCard` em `src/pages/Settings.tsx`

Substituir todo o componente `PlanCard` mantendo a busca de `cpfQuery`, o `useSubscription()` e o `handleCheckout` existentes. Estrutura nova:

**Header do card:** título fixo "Seu Plano" + ícone `Sparkles`. Description curta abaixo.

**Estado `isActive` (Pro):**
```text
┌─────────────────────────────────────────┐
│ Seu Plano                               │
│                                         │
│ Plano Atual: Pro            [● Ativo]   │
│ Taxa da plataforma zerada (0%).         │
│ Você lucra 100% nas suas entregas.      │
│                                         │
│ [Histórico de Faturas]  [Cancelar...]   │
└─────────────────────────────────────────┘
```
- Botão "Histórico de Faturas" → `variant="outline"`, abre `customerPortalUrl` em nova aba (lógica atual).
- Botão "Cancelar Assinatura" → `variant="ghost"` com `text-destructive` (link vermelho discreto, evita destacar demais a saída). Abre `<AlertDialog>`.

**Estado `isOverdue`:** mantém comportamento atual (badge âmbar "Pagamento em atraso", botões "Atualizar status" + "Pagar fatura"). Card único, sem o split de blocos.

**Estado default (PayGo / `!isActive && !isOverdue`):**
```text
┌─────────────────────────────────────────┐
│ Seu Plano                               │
│                                         │
│ Plano Atual: PayGo          [● Ativo]   │
│ Sem mensalidade. Você paga apenas       │
│ a taxa de 2,9% por pagamento aprovado.  │
│ ─────────────────────────────────────   │
│ PixelSafe Pro — R$ 39/mês  ✨           │
│ Zere a taxa da plataforma (0%) e        │
│ lucre 100% nas suas entregas.           │
│                                         │
│ [Atualizar status]  [Assinar Plano Pro] │
│ ⚠ Preencha seu CPF/CNPJ no card de      │
│   Perfil acima para liberar a           │
│   assinatura. (se hasCpfCnpj=false)     │
└─────────────────────────────────────────┘
```
- Badge "Ativo" verde reutiliza o estilo atual `bg-emerald-500/15 text-emerald-500`.
- Divisor: `<div className="border-t border-border my-4" />`.
- Botão "Assinar Plano Pro" e o aviso de CPF/CNPJ ficam **dentro do bloco 2** (visualmente atrelados à oferta de upgrade), não na base do card.

### 3. AlertDialog de Cancelamento

Adicionar `AlertDialog` (já disponível em `@/components/ui/alert-dialog`) controlado por `useState`. Conteúdo:

- **Title:** "Cancelar assinatura PixelSafe Pro?"
- **Description:** "Você voltará automaticamente ao plano PayGo. Continuará podendo criar e vender cofres, mas a taxa de 2,9% sobre cada pagamento aprovado voltará a ser cobrada. Esta ação é imediata."
- **Cancel:** "Manter Pro"
- **Action (destructive):** "Sim, cancelar" — dispara `cancelMutation.mutate()`.

Mutation:
```ts
const cancelMutation = useMutation({
  mutationFn: async () => {
    const { error } = await supabase.functions.invoke("cancel-subscription", { body: {} });
    if (error) throw error;
  },
  onSuccess: () => {
    toast({ title: "Assinatura cancelada", description: "Você voltou ao plano PayGo." });
    queryClient.invalidateQueries({ queryKey: ["subscription", user?.id] });
    refetch();
  },
  onError: (err) => toast({ title: "Erro ao cancelar", description: err.message, variant: "destructive" }),
});
```
Botão de cancelar mostra `Loader2` quando `cancelMutation.isPending`.

### 4. Atualização de `docs/TECH_SPEC.md`

- Na lista de Edge Functions com `verify_jwt = true` (linha ~127), adicionar `cancel-subscription`.
- Criar subseção `### cancel-subscription` documentando: validação de JWT, lookup de `asaas_subscription_id`, `DELETE` no Asaas (com tratamento idempotente do 404), update de `subscription_status` para `inactive`, idempotência com webhook `SUBSCRIPTION_DELETED`.
- Na seção "Página `/configuracoes`" → reescrever a descrição do "Card Plano" detalhando os 3 estados visuais (PayGo / Pro / Overdue), o split de blocos PayGo+Upgrade e o fluxo de cancelamento via AlertDialog.
- Em "Pendências" (final do arquivo), remover qualquer item relacionado a "cancelamento in-app" ou "gerenciamento de assinatura via portal externo".

### Detalhes técnicos relevantes

- **Reuso:** `asaasBaseUrl()` será copiado do `asaas-checkout` para `cancel-subscription` (mesma convenção do projeto — não há `_shared/asaas.ts` hoje, e criar um helper só por isso é over-engineering).
- **CORS:** importar `corsHeaders` de `@supabase/supabase-js@2.95.0/cors` (mesmo padrão das outras functions).
- **Sem migration:** nenhuma alteração de schema. Apenas leitura/update em `profiles`, RLS já permite o owner. A function usa `service_role` por consistência com `asaas-checkout`.
- **Sem novos secrets:** `ASAAS_API_KEY` e `ASAAS_ENV` já existem.
- **Testes manuais sugeridos após o build:**
  1. Logar como user PayGo → ver dois blocos com badge "Ativo" no PayGo.
  2. Assinar Pro → após webhook, card colapsa para visual single-block "Pro".
  3. Cancelar → AlertDialog → confirmar → toast → card volta para visual PayGo (refetch automático).
