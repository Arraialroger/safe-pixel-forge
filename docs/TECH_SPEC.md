# Cofre — Especificação Técnica

Fonte da verdade do projeto. Atualizar ao final de cada fase.

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript 5
- **UI**: Tailwind CSS v3, shadcn/ui (Radix), lucide-react
- **Estado/Dados**: TanStack Query, React Hook Form + Zod
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions)
- **Pagamentos**: Mercado Pago (Checkout Pro / Preferences API)

## Estrutura do Banco (Supabase)

### `profiles`
Dados estendidos do usuário autenticado. Populada automaticamente pelo trigger `handle_new_user` no Sign Up.
- `id` (uuid, PK), `full_name`, `email`, `custom_logo_url`, `created_at`
- `custom_logo_url` é exibida na Sidebar (autenticado) e na página pública de checkout (`/pay/:slug`) substituindo a logo padrão do PixelSafe.
- **RLS**: owner-only (`id = auth.uid()`). Leitura pública é feita exclusivamente via Edge Function `get-owner-branding` (com `service_role`), retornando apenas `custom_logo_url` e `full_name`.

### `vaults`
Cofre = entrega de projeto + cobrança vinculada.
- `id` (uuid, PK), `owner_id` (uuid, dono autenticado)
- `title`, `client_name`, `client_email`, `client_whatsapp`
- `price` (numeric), `status` (`pending` | `paid`, default `pending`)
- `file_path`, `file_name` (referência ao bucket `vault-files`)
- `public_slug` (string curta única, default 12 chars de uuid) — usada na URL pública
- `created_at`
- **RLS**:
  - `Owners manage own vaults`: ALL para `authenticated` quando `owner_id = auth.uid()`.
  - `Public can read vaults`: SELECT para `anon` e `authenticated` (necessário para o checkout público funcionar pelo slug).

### `workspaces`
Configurações por dono — guarda credenciais sensíveis do vendedor. Populada automaticamente pelo trigger `handle_new_user`.
- `id` (uuid, PK), `owner_id`, `mp_access_token`, `created_at`
- **Constraint**: `UNIQUE (mp_access_token)` — um mesmo Access Token do Mercado Pago não pode ser vinculado a mais de uma conta no PixelSafe (regra antifraude contra múltiplas contas do mesmo vendedor). O frontend (`Settings → MercadoPagoCard`) intercepta o erro Postgres `23505` e mostra um toast amigável: _"Este token do Mercado Pago já está vinculado a outra conta no PixelSafe."_
- **RLS**: owner-only (`owner_id = auth.uid()`).

### Storage
- Bucket **`vault-files`** (privado). Layout: `${user_id}/${vault_id}/${nome_seguro}`.
- Bucket **`logos`** (público). Layout: `${user_id}/logo_imagem.{ext}`.
  - Policies em `storage.objects`: `INSERT`/`UPDATE`/`DELETE` permitidos apenas quando `bucket_id = 'logos' AND (storage.foldername(name))[1] = auth.uid()::text`. `SELECT` público para o bucket `logos` (necessário para o `upsert: true` checar existência e para servir as logos no checkout).
  - `profiles.custom_logo_url` armazena **apenas a URL pública limpa**. O cache-busting (`?v=...`) é aplicado **na renderização** (derivado de `query.dataUpdatedAt`) — nunca persistido no banco.

## Padrão de auth-ready (RLS)

Para evitar race condition entre montagem de componentes e restauração da sessão Supabase, todos os `useQuery` que dependem de `auth.uid()` (RLS) usam o hook `useAuthReady` (`src/hooks/useAuthReady.ts`) e definem `enabled: isReady && !!user?.id`. O `AuthenticatedLayout` também aguarda `isReady` antes de renderizar filhos. Sem esse guard, queries podem disparar antes do JWT ser anexado ao cliente, retornando `null` silenciosamente devido à RLS.

Convenção de query keys (evita colisão entre componentes que selecionam shapes diferentes da mesma tabela):
- `["owner-branding", userId]` — Sidebar (subset: logo + nome).
- `["profile-settings", userId]` — Tela de Configurações (full_name, email, custom_logo_url).
- `["workspace", userId]` — workspace do owner.
- `["public-owner-branding", ownerId]` — checkout público (via Edge Function).

## Rotas

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `/` | público | Landing |
| `/login` | público | Autenticação Supabase |
| `/pay/:slug` | público | Checkout do cofre pelo `public_slug` |
| `/dashboard` | autenticado | Lista de cofres do owner + KPIs financeiros |
| `/clientes` | autenticado | Mini-CRM derivado dos cofres (sem tabela própria) |
| `/configuracoes` | autenticado | Multi-tenant: edição de perfil, upload de logo, integração Mercado Pago e plano (placeholder SaaS) |
| `*` | público | NotFound |

Layout autenticado em `src/layouts/AuthenticatedLayout.tsx` (sidebar + outlet).

## Fluxo de Criação de Cofre

`NewVaultDialog` (autenticado):
1. Form validado por Zod (`title`, `client_name`, `client_email`, `client_whatsapp?`, `price`, `status`, `notify_client`).
2. Insere linha em `vaults`.
3. Se houver arquivo, faz upload em `vault-files` no path `${user.id}/${vault.id}/${nome}`; em caso de erro, faz rollback do insert.
4. Atualiza `file_path` e `file_name`.
5. Se `notify_client === true` e há `client_email`, invoca a Edge Function `send-vault-created`. Falha do e-mail é **não-fatal**: o cofre é mantido e o toast indica que o envio falhou.
6. Invalida `["vaults"]`.

## Fluxo de Compartilhamento (`VaultCard`)

- **Copiar link**: copia `${origin}/pay/${public_slug}` para o clipboard.
- **WhatsApp (contextual por status)**: abre `https://wa.me/{numero}?text={texto}`. Se `client_whatsapp` preenchido → `55{digits}`; caso contrário, sem destinatário. O texto muda conforme `vault.status`:
  - `pending` → mensagem de cobrança ("Acesse o link seguro para realizar o pagamento e liberar o download…").
  - `paid` → mensagem de download ("Pagamento confirmado! Seu arquivo já está disponível para download…").
- **Reenviar e-mail**: item no `DropdownMenu` (ícone `Mail`, `Loader2` durante `isPending`) que invoca a Edge Function `resend-vault-email`. O backend escolhe o template com base no status atual (cobrança vs liberação). Toast de sucesso/erro com a mensagem retornada.
- **Excluir**: remove arquivo do storage (best-effort) e a linha em `vaults`. Confirmação via `AlertDialog`.

## Pagamento — Edge Functions

Em `supabase/functions/`. Configuração de auth em `supabase/config.toml`:
- `create-payment`, `mp-webhook`, `get-download-url`, `get-owner-branding` → `verify_jwt = false` (rotas públicas / chamadas pelo Mercado Pago).
- `send-vault-created`, `resend-vault-email` → `verify_jwt = true` (somente o dono autenticado dispara).

### `create-payment`
Entrada: `{ vault_id: uuid }`. Fluxo:
1. Valida body (Zod).
2. Cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS).
3. Busca vault por `id`. Rejeita se já `paid`.
4. Busca `mp_access_token` em `workspaces` pelo `owner_id` do vault.
5. `POST https://api.mercadopago.com/checkout/preferences` com `items`, `external_reference = vault.id`, `back_urls` (success/failure/pending), `auto_return: "approved"` e `notification_url = ${SUPABASE_URL}/functions/v1/mp-webhook?vault_id=${vault.id}`.
6. Retorna `{ init_point, preference_id }`.

No frontend (`PayVault.tsx`), o botão chama `supabase.functions.invoke('create-payment')` e redireciona via `window.location.href = init_point`.

### `mp-webhook` (validado)
Endpoint público chamado pelo Mercado Pago em vários estágios do pagamento (pending, in_process, approved, rejected...). **Só libera o cofre quando o MP confirma `approved`**. Sempre responde `200`.
1. Lê `vault_id` da query string e `body.type` (ou `body.topic`/`body.action`) do POST.
2. Se `type !== "payment"` → ignora (ex.: `merchant_order`).
3. Lê `body.data.id` (paymentId). Busca `vault.owner_id` e em seguida `mp_access_token` em `workspaces`.
4. `GET https://api.mercadopago.com/v1/payments/{paymentId}` com `Authorization: Bearer {mp_access_token}`.
5. **Anti-spoof**: se `payment.external_reference` existir e for ≠ `vault_id`, ignora.
6. Se `payment.status !== "approved"` → log + `200 OK` sem alterar DB.
7. Caso `approved`: `UPDATE vaults SET status='paid' WHERE id=vault_id AND status<>'paid' RETURNING title, client_email, public_slug` (idempotente).
8. Se houve mudança e há `client_email`, dispara e-mail de liberação via Resend:
   - From: `PixelSafe <suporte@pixelsafe.com.br>`
   - Subject: `Seu arquivo "{title}" está liberado! 🔓`
   - HTML com CTA para `${PUBLIC_APP_URL}/pay/${public_slug}`.

### `get-download-url`
Entrada: `{ slug: string }`. Fluxo:
1. Busca o vault pelo `public_slug`.
2. Se `status !== 'paid'` → `403`.
3. Gera Signed URL de **15 minutos** (`vault-files`, `createSignedUrl(file_path, 900)`).
4. Retorna `{ signed_url }`. O frontend abre em nova aba.

### `send-vault-created`
Entrada: `{ vault_id: uuid }`. Disparada pelo `NewVaultDialog` após criar o cofre, se o checkbox "Enviar link por e-mail" estiver marcado.
1. Valida JWT do owner via `getClaims`.
2. Carrega vault com service-role e confere `vault.owner_id === claims.sub` (403 se não bater).
3. Se não há `client_email`, retorna `{ skipped: true }`.
4. Envia e-mail via Resend:
   - From: `PixelSafe <suporte@pixelsafe.com.br>`
   - Subject: `Arquivo de {title} disponível para liberação 🔐`
   - CTA → `${PUBLIC_APP_URL}/pay/${public_slug}`.
5. Falha de envio retorna 502; o frontend trata como warning não-bloqueante.

### `get-owner-branding`
Endpoint público usado pelo checkout (`/pay/:slug`) para renderizar a logo customizada do dono do cofre sem expor a tabela `profiles`.
- Entrada: `{ owner_id: uuid }` (validado por Zod).
- `verify_jwt = false`. Cliente Supabase com `SERVICE_ROLE_KEY`.
- Retorna **somente** `{ custom_logo_url, full_name }` — nenhum outro campo de `profiles` é exposto.

### `resend-vault-email`
Reenvio manual sob demanda (botão "Reenviar e-mail" no `VaultCard`). `verify_jwt = true`.
1. Valida JWT via `getClaims` e extrai `claims.sub`.
2. Body validado por Zod: `{ vault_id: uuid }`.
3. Carrega vault com service-role; **403** se `vault.owner_id !== claims.sub`.
4. **400** `{ error: "Cliente sem e-mail cadastrado" }` se `client_email` for null (feedback explícito ao usuário no toast — diferente de `send-vault-created`, que apenas faz `skipped`).
5. Branch por status:
   - `pending` → assunto `Arquivo de {title} disponível para liberação 🔐` (template idêntico ao `send-vault-created`).
   - `paid` → assunto `Seu arquivo "{title}" está liberado! 🔓` (template idêntico ao do `mp-webhook`).
6. Falha no Resend → **502** `{ error: "Falha ao enviar e-mail" }`.
7. Sucesso → `{ success: true, kind: "pending" | "paid" }`.

### Variáveis de ambiente (Edge Functions)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (gerenciadas).
- `RESEND_API_KEY` (configurada).
- `PUBLIC_APP_URL` (opcional, fallback hardcoded para a URL publicada).

## Página `/configuracoes` (multi-tenant)

Tela 100% baseada em dados reais (TanStack Query) da conta autenticada.

- **Card "Perfil e marca"**: lê/edita `profiles.full_name` e gerencia upload de logo no bucket `logos` (path `${user.id}/logo_imagem.{ext}`, `upsert: true`). Persiste a URL pública limpa em `profiles.custom_logo_url`; o cache-busting é aplicado em runtime via `query.dataUpdatedAt`. Suporta remoção da logo.
- **Card "Integração financeira — Mercado Pago"**: lê/edita `workspaces.mp_access_token`. Quando já existe um token, exibe apenas `APP_USR-••••-{4_últimos}` em fonte monoespaçada com botão "Substituir token". Input sempre `type="password"`.
- **Card "Plano"**: placeholder visual ("Beta") com texto indicando que a cobrança SaaS chega na V1.0. Botão "Gerenciar plano" desabilitado com tooltip "Em breve".

Hook compartilhado `src/hooks/useBranding.ts`:
- `useOwnerBranding()` — para a Sidebar autenticada (lê `profiles` direto via RLS owner-only).
- `usePublicOwnerBranding(ownerId)` — para o checkout público (chama `get-owner-branding`).

A `Logo` (`src/components/Logo.tsx`) aceita `customLogoUrl`; se presente, renderiza `<img>` no lugar do ícone padrão.

## Estados da página `/pay/:slug`

A página lê o status do cofre no Supabase + o query param `?status=` adicionado pelas `back_urls` do MP. Decisão:

| Estado do cofre | `?status=` na URL | UI renderizada |
| --- | --- | --- |
| `paid` | qualquer | **SuccessCard** (verde, botão "Baixar arquivo") |
| `pending` | `pending` / `in_process` / `in_mediation` | **ProcessingCard** (âmbar, sem botão de pagar; faz polling a cada 10s para flipar quando o webhook confirmar) |
| `pending` | ausente / outro | **CheckoutCard** (botão "Pagar e Liberar Arquivo") |

O header da página renderiza a logo customizada do owner (via `usePublicOwnerBranding(vault.owner_id)`) quando configurada — co-branding agência/PixelSafe (rodapé continua com "Protegido por PixelSafe").

A `ProcessingCard` exibe a mensagem: _"Recebemos o seu pedido! Estamos aguardando a confirmação do Mercado Pago. Assim que o pagamento for processado (boletos podem levar até 2 dias úteis), o arquivo será liberado aqui e enviaremos um aviso para o seu e-mail."_

## PLG / Plano gratuito (V0)

Enquanto a cobrança SaaS (Fase 8 / Asaas) não está ativa, vale o limite **`FREE_PLAN_LIMIT = 1` cofre por owner**. A catraca vive no `NewVaultDialog`:

- Hook `useQuery({ queryKey: ["vaults-count", userId], head: true, count: "exact" })` calcula a contagem com 1 round-trip barato (sem trazer linhas) já filtrado pela RLS.
- O botão "Novo Cofre" deixa de ser `DialogTrigger` direto. O `onClick` chama `handleNewClick()`: se `count >= FREE_PLAN_LIMIT`, abre um `AlertDialog` ("Limite do plano gratuito atingido") em vez do modal de criação. O botão "Entendi" apenas fecha (Fase 8 ligará no checkout Asaas).
- **Defesa em profundidade**: a `mutationFn` refaz o `count` antes do `INSERT` e aborta com mensagem amigável caso uma corrida entre abas tenha furado o guard do frontend.
- A `onSuccess` invalida `["vaults-count", userId]` além de `["vaults"]`.

A enforcement definitiva (RLS / edge function checando `subscription_status`) chega na Fase 8.

## Mini-CRM (`/clientes`)

**Sem tabela nova.** A página deriva os contatos em memória a partir do mesmo cache TanStack Query usado pelo Dashboard (`["vaults", userId]`):

- Reduz os vaults agrupando por `client_email.toLowerCase()` como chave única.
- Cada linha exibe: Nome, E-mail, WhatsApp formatado (`formatBRPhone`) com botão `wa.me/55{digits}` em nova aba, e Total de projetos (contagem de cofres com aquele e-mail).
- Vaults sem `client_email` são ignorados.
- Empty state quando não há contatos: mensagem + CTA para o Dashboard.
- Custo no banco: **zero queries adicionais** quando o usuário já passou pelo Dashboard.

## KPIs do Dashboard

Acima da grid de cofres, `StatsCards` (`src/components/StatsCards.tsx`) renderiza 3 cards derivados em `useMemo` da mesma lista de vaults — sem query extra:

- **Total recebido**: soma `price` onde `status = 'paid'` (formato BRL).
- **Aguardando pagamento**: soma `price` onde `status = 'pending'` (formato BRL).
- **Projetos entregues**: contagem de vaults com `status = 'paid'`.

Os cards só aparecem quando `vaults.length > 0` (evita métricas zeradas no empty state).

## Fase 8 — Monetização SaaS via Asaas

Plano único **Pro** (R$ 39,00/mês) com cobrança recorrente Asaas. Pix, boleto e cartão (`billingType: "UNDEFINED"` permite o cliente escolher na invoice page).

### Schema (`profiles`)
- `asaas_customer_id` (text, nullable) — ID do customer no Asaas.
- `asaas_subscription_id` (text, nullable) — ID da subscription.
- `subscription_status` (text, default `'inactive'`) — valores usados: `active`, `overdue`, `inactive`.

Customer/Subscription são criados **lazy**, somente quando o usuário inicia o checkout pela primeira vez. Contas que nunca tentaram assinar não consomem recursos no Asaas.

### Edge Function `asaas-checkout` (`verify_jwt = true`)
Idempotente:
1. Valida JWT via `getClaims()`, lê `userId`.
2. Busca `profiles`. Se `asaas_customer_id` vazio → `POST /customers` (`access_token` header) e persiste.
3. Se `asaas_subscription_id` vazio → `POST /subscriptions` (`value: 39`, `cycle: MONTHLY`, `nextDueDate: hoje+1`, `externalReference: userId`) e persiste.
4. `GET /subscriptions/{id}/payments` → escolhe a fatura `PENDING/OVERDUE` mais recente, ou a primeira disponível.
5. Retorna `{ invoiceUrl, customerId, subscriptionId, alreadyActive }`.
- Base URL resolvida pelo secret `ASAAS_ENV` (`sandbox` → `api-sandbox.asaas.com`, `production` → `api.asaas.com`).

### Edge Function `asaas-webhook` (`verify_jwt = false`)
- Autenticação: header `asaas-access-token` deve bater com o secret `ASAAS_WEBHOOK_TOKEN`. Falha → 401. Sucesso → sempre 200 (evita reentrega infinita).
- Localiza o `profile` por `asaas_customer_id` (preferido) ou `asaas_subscription_id` (fallback).
- Mapeamento de evento → `subscription_status`:
  - `PAYMENT_CONFIRMED`, `PAYMENT_RECEIVED`, `PAYMENT_RECEIVED_IN_CASH`, `PAYMENT_APPROVED_BY_RISK_ANALYSIS` → `active`
  - `PAYMENT_OVERDUE` → `overdue`
  - `PAYMENT_DELETED`, `PAYMENT_REFUNDED`, `PAYMENT_REFUND_IN_PROGRESS`, `PAYMENT_CHARGEBACK_REQUESTED`, `PAYMENT_CHARGEBACK_DISPUTE`, `PAYMENT_REPROVED_BY_RISK_ANALYSIS`, `SUBSCRIPTION_DELETED`, `SUBSCRIPTION_INACTIVATED` → `inactive`
  - Demais eventos: ignorados (200 ok).
- **URL a configurar no painel Asaas**: `https://ymqrbxiqtadliydzqldj.supabase.co/functions/v1/asaas-webhook` com header `asaas-access-token`.

### Frontend
- **`useSubscription`** (`src/hooks/useSubscription.ts`): lê `profiles.subscription_status` via TanStack Query (`["subscription", userId]`). Expõe `isActive`, `isOverdue`, `refetch`.
- **`Settings → PlanCard`**: card real do Plano Pro.
  - `inactive`: botão **Assinar Plano Pro** chama `asaas-checkout` e abre `invoiceUrl` em nova aba.
  - `overdue`: badge âmbar + botão **Pagar fatura** (mesmo fluxo, devolve a fatura overdue).
  - `active`: badge verde + **Gerenciar assinatura** abre o portal do cliente Asaas (`sandbox.asaas.com/customerInvoices` ou `www.asaas.com/customerInvoices`).
  - Botão **Atualizar status** força `refetch()` após o pagamento.
- **Catraca PLG (`NewVaultDialog`)**: além do `count >= FREE_PLAN_LIMIT`, agora exige `!subscriptionActive`. Assinante pode criar cofres ilimitados. Botão "Assinar agora" do `AlertDialog` redireciona para `/configuracoes`. A defesa em profundidade na `mutationFn` aplica a mesma regra.
- **Banner global (`AuthenticatedLayout`)**: se `isOverdue`, renderiza barra âmbar acima do `<main>` com CTA "Regularizar" → `/configuracoes`.

## Pendências (próximas fases)

- Validar assinatura HMAC do webhook do Mercado Pago (header `x-signature`) como camada adicional ao cross-check de `external_reference`.
- **Fase 7.6 — Hardening de isolamento na tabela `vaults`**: substituir a política `Public can read vaults` (`USING (true)`) por uma VIEW `vaults_public` com `security_invoker=on` expondo apenas as colunas necessárias ao checkout (`id`, `public_slug`, `title`, `price`, `client_name`, `status`, `custom_logo_url` do owner) e bloquear o `SELECT` direto da tabela base para `anon`. Isso elimina a dependência exclusiva do filtro client-side `.eq("owner_id", ...)` (hoje aplicado em Dashboard, Clients e Catraca PLG como defesa em profundidade) e impede qualquer vazamento futuro caso uma nova tela esqueça o filtro.
- Revogar `asaas_subscription_id` no Asaas (`DELETE /subscriptions/{id}`) caso o usuário cancele dentro do app — hoje o cancelamento é feito apenas pelo portal do cliente Asaas.

