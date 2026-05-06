# PixelSafe — Especificação Técnica

Fonte da verdade do projeto. Atualizar ao final de cada fase.

## Stack

- **Frontend**: React 18 + Vite 5 + TypeScript 5
- **UI**: Tailwind CSS v3, shadcn/ui (Radix), lucide-react
- **Estado/Dados**: TanStack Query, React Hook Form + Zod
- **Routing**: React Router v6
- **Backend**: Supabase (Auth, Postgres, Storage, Edge Functions)
- **Pagamentos**: Mercado Pago (Checkout Pro / Preferences API)
- **E-mails transacionais**: Resend (helper compartilhado `_shared/resend.ts`)
- **Assinaturas SaaS**: Asaas (Pix, boleto e cartão)

## Estrutura do Banco (Supabase)

### `profiles`
Dados estendidos do usuário autenticado. Populada automaticamente pelo trigger `handle_new_user` no Sign Up.
- `id` (uuid, PK), `full_name`, `email`, `custom_logo_url`, `created_at`
- `cpf_cnpj` (text, nullable) — documento do dono da conta. **Obrigatório** para o fluxo de assinatura Asaas (Fase 8): a Edge Function `asaas-checkout` valida o campo (11 ou 14 dígitos) e envia como `cpfCnpj` no `POST /customers`. O frontend (`Settings → ProfileCard`) normaliza via Zod (apenas dígitos) antes de salvar; o `PlanCard` bloqueia o botão "Assinar Plano Pro" quando vazio.
- `asaas_customer_id`, `asaas_subscription_id`, `subscription_status` (default `'inactive'`) — controle da assinatura Asaas (Fase 8).
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
- `expires_at` (timestamptz, nullable, default `now() + interval '30 days'`) — Fase 10. Sobrescrito pelo `mp-webhook` para `now() + 7 dias` quando o pagamento é confirmado.
- `downloaded_at` (timestamptz, nullable) — Fase 11. Trava atômica usada por `get-download-url` (`UPDATE ... WHERE downloaded_at IS NULL`) para garantir que o e-mail "Cliente baixou" ao dono seja disparado **uma única vez**, mesmo com múltiplos cliques no botão de download.
- **RLS**:
  - `Owners manage own vaults`: ALL para `authenticated` quando `owner_id = auth.uid()`.
  - **Acesso anônimo revogado** (Fase 7.6 — hardening de segurança): a antiga policy `Public can read vaults` (`USING (true)`) foi removida porque expunha PII dos clientes (`client_email`, `client_whatsapp`) a qualquer visitante. O checkout público agora consome a tabela exclusivamente via RPC `public.get_public_vault_by_slug(_slug text)` — função `SECURITY DEFINER`, `STABLE`, com `search_path = public` e `EXECUTE` concedido a `anon` e `authenticated`. A RPC retorna apenas o subconjunto seguro de colunas necessário ao checkout: `id`, `title`, `client_name`, `price`, `status`, `public_slug`, `file_name`, `owner_id`, `expires_at`. Nenhum campo sensível (e-mail, WhatsApp, `file_path`) é exposto ao frontend público.

### `workspaces`
Configurações por dono — guarda credenciais sensíveis do vendedor. Populada automaticamente pelo trigger `handle_new_user`.
- `id` (uuid, PK), `owner_id`, `mp_access_token`, `mp_refresh_token`, `mp_public_key`, `mp_user_id`, `created_at`.
- A partir da **Fase 13**, esses campos são preenchidos exclusivamente pelo fluxo OAuth do Mercado Pago (edge function `mp-oauth-callback`). O input manual de Access Token foi removido da UI.
- **RLS**: owner-only (`owner_id = auth.uid()`). O `update` da edge function `mp-oauth-callback` usa `service_role` (bypassa RLS) para gravar os tokens recebidos do MP.

### `vault_events`
Log de atividades por cofre (Fase 12). Detalhes na seção própria.
- `id`, `vault_id` (FK → `vaults.id` ON DELETE CASCADE), `event_type` (text + CHECK), `created_at`.
- **RLS**: SELECT apenas para o owner do cofre. Sem policies de INSERT/UPDATE/DELETE (writes via `service_role`).

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
- `["vault-events", vaultId]` — Timeline de eventos (Fase 12).

## Rotas

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `/` | público | Landing |
| `/login` | público | Autenticação Supabase |
| `/forgot-password` | público | Solicitação de recuperação de senha (Fase 9) |
| `/reset-password` | público | Definição de nova senha via token de recovery (Fase 9) |
| `/install` | público | Instruções de instalação PWA (Fase 9) |
| `/pay/:slug` | público | Checkout do cofre pelo `public_slug` |
| `/dashboard` | autenticado | Lista de cofres do owner + KPIs financeiros |
| `/clientes` | autenticado | Mini-CRM derivado dos cofres (sem tabela própria) |
| `/configuracoes` | autenticado | Multi-tenant: edição de perfil, upload de logo, integração Mercado Pago e plano (Asaas) |
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
- **Ver histórico**: item no `DropdownMenu` (ícone `History`) abre um `Dialog` com `<VaultTimeline vaultId={vault.id} />` (Fase 12).
- **Excluir**: remove arquivo do storage (best-effort) e a linha em `vaults`. Confirmação via `AlertDialog`.

## Helpers compartilhados (`supabase/functions/_shared/`)

Centralizam boilerplate consumido por múltiplas Edge Functions.

### `_shared/resend.ts`
Padroniza envio de e-mails transacionais via Resend e o layout HTML (mantém uma única fonte de verdade visual e evita duplicação de markup).
- `sendResendEmail({ to, subject, heading, bodyHtml, ctaLabel?, ctaUrl?, footerNote? })` — monta o layout responsivo (table-based, compatível com clientes de e-mail), injeta CTA opcional e dispara via `https://api.resend.com/emails`. Retorna `{ ok, status, error? }`.
- `escapeHtml(s)` — sanitiza interpolações dinâmicas no HTML.
- `PUBLIC_APP_URL` — resolve `Deno.env.get("PUBLIC_APP_URL")` com fallback para a URL publicada.
- `From` fixo: `PixelSafe <suporte@pixelsafe.com.br>`.

Consumidores: `send-vault-created`, `resend-vault-email`, `mp-webhook` (cliente + dono), `get-download-url` (dono).

### `_shared/events.ts`
Padroniza inserts em `vault_events` a partir do backend (com `service_role`).
- Tipo exportado `VaultEventType = 'page_viewed' | 'checkout_started' | 'payment_approved' | 'downloaded'`.
- `recordVaultEvent(supabase, vaultId, eventType)` — insert não-fatal (loga erro mas não lança), usado pelos triggers internos do `mp-webhook` e do `get-download-url`. Eventos públicos (`page_viewed`, `checkout_started`) passam pela Edge Function `log-vault-event` com allowlist + dedupe.

## Pagamento — Edge Functions

Em `supabase/functions/`. Configuração de auth em `supabase/config.toml`:
- `verify_jwt = false` (rotas públicas / chamadas externas): `create-payment`, `mp-webhook`, `get-download-url`, `get-owner-branding`, `asaas-webhook`, `cleanup-expired-vaults` (autenticada por secret próprio), `log-vault-event`.
- `verify_jwt = true` (somente dono autenticado dispara): `send-vault-created`, `resend-vault-email`, `asaas-checkout`, `cancel-subscription`.

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
7. Caso `approved`: `UPDATE vaults SET status='paid', expires_at = now() + 7d WHERE id=vault_id AND status<>'paid' RETURNING title, client_email, client_name, public_slug, owner_id, price` (idempotente; o `expires_at` é renovado para janela de 7 dias da Fase 10).
8. Após o update atômico bem-sucedido, registra evento `payment_approved` via `recordVaultEvent` (Fase 12).
9. Dispara **dois** e-mails via `_shared/resend.ts`:
   - **Cliente** (se houver `client_email`): assunto `Seu arquivo "{title}" está liberado! 🔓`, CTA → `${PUBLIC_APP_URL}/pay/${public_slug}`.
   - **Profissional / dono** (Fase 11): busca `profiles(email, full_name)` por `owner_id`. Assunto `💸 Pix recebido: {title} ({R$ valor})` com bloco resumo (cliente, valor BRL formatado via `Intl.NumberFormat`, título do cofre), CTA "Ver no Dashboard" e nota de rodapé avisando que outro e-mail será enviado quando o cliente baixar.
10. Falhas de e-mail são logadas mas **não-fatais** — o webhook sempre responde 200.

### `get-download-url`
Entrada: `{ slug: string }`. Fluxo:
1. Busca o vault pelo `public_slug` (campos: `id, status, file_path, downloaded_at, owner_id, client_name, title`).
2. Se `status !== 'paid'` → `403`. Se `file_path` for `null` (ex.: cofre limpo pela Fase 10.1) → `409`.
3. Gera Signed URL de **15 minutos** (`vault-files`, `createSignedUrl(file_path, 900)`).
4. **Trava atômica de primeiro download** (Fase 11): se `downloaded_at IS NULL`, executa `UPDATE vaults SET downloaded_at = now() WHERE id = ? AND downloaded_at IS NULL RETURNING id`. Apenas a chamada que **ganha a corrida** (linha retornada) executa o pós-processamento:
   - Registra evento `downloaded` via `recordVaultEvent` (Fase 12).
   - Busca `profiles(email, full_name)` do owner e envia e-mail "📥 Cliente baixou: {title}" via `_shared/resend.ts`, com CTA "Ver no Dashboard". Falha de e-mail é não-fatal.
5. Reentradas subsequentes pulam todo o pós-processamento e apenas devolvem o `signed_url` — evita spam de e-mails ao dono caso o cliente clique em "Baixar" várias vezes.
6. Retorna `{ signed_url }`. O frontend abre em nova aba.

### `send-vault-created`
Entrada: `{ vault_id: uuid }`. Disparada pelo `NewVaultDialog` após criar o cofre, se o checkbox "Enviar link por e-mail" estiver marcado.
1. Valida JWT do owner via `getClaims`.
2. Carrega vault com service-role e confere `vault.owner_id === claims.sub` (403 se não bater).
3. Se não há `client_email`, retorna `{ skipped: true }`.
4. Envia e-mail via `_shared/resend.ts`:
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
- `CLEANUP_SECRET` (Fase 10.1) — autentica a `cleanup-expired-vaults`.
- `ASAAS_API_KEY`, `ASAAS_WEBHOOK_TOKEN`, `ASAAS_ENV` (Fase 8).

## Página `/configuracoes` (multi-tenant)

Tela 100% baseada em dados reais (TanStack Query) da conta autenticada.

- **Card "Perfil e marca"**: lê/edita `profiles.full_name` e gerencia upload de logo no bucket `logos` (path `${user.id}/logo_imagem.{ext}`, `upsert: true`). Persiste a URL pública limpa em `profiles.custom_logo_url`; o cache-busting é aplicado em runtime via `query.dataUpdatedAt`. Suporta remoção da logo.
- **Card "Integração financeira — Mercado Pago"**: lê/edita `workspaces.mp_access_token`. Quando já existe um token, exibe apenas `APP_USR-••••-{4_últimos}` em fonte monoespaçada com botão "Substituir token". Input sempre `type="password"`.
- **Card "Seu Plano"**: card unificado de gestão de plano e taxas (Fase 8 — Asaas + Fase 14 — Cancelamento in-app). Detalhes de UX e estados na seção "Frontend" da Fase 8 abaixo.

Hook compartilhado `src/hooks/useBranding.ts`:
- `useOwnerBranding()` — para a Sidebar autenticada (lê `profiles` direto via RLS owner-only).
- `usePublicOwnerBranding(ownerId)` — para o checkout público (chama `get-owner-branding`).

A `Logo` (`src/components/Logo.tsx`) aceita `customLogoUrl`; se presente, renderiza `<img>` no lugar do ícone padrão.

## Estados da página `/pay/:slug`

A página lê o status do cofre no Supabase + o query param `?status=` adicionado pelas `back_urls` do MP. Decisão (ordem de prioridade):

| Estado do cofre | `?status=` na URL | UI renderizada |
| --- | --- | --- |
| `expires_at` no passado | qualquer | **ExpiredCard** (prioridade máxima) |
| `paid` | qualquer | **SuccessCard** (verde, botão "Baixar arquivo") |
| `pending` | `pending` / `in_process` / `in_mediation` | **ProcessingCard** (âmbar, sem botão de pagar; faz polling a cada 10s para flipar quando o webhook confirmar) |
| `pending` | ausente / outro | **CheckoutCard** (botão "Pagar e Liberar Arquivo") |

O header da página renderiza a logo customizada do owner (via `usePublicOwnerBranding(vault.owner_id)`) quando configurada — co-branding agência/PixelSafe (rodapé continua com "Protegido por PixelSafe").

A `ProcessingCard` exibe a mensagem: _"Recebemos o seu pedido! Estamos aguardando a confirmação do Mercado Pago. Assim que o pagamento for processado (boletos podem levar até 2 dias úteis), o arquivo será liberado aqui e enviaremos um aviso para o seu e-mail."_

## PLG / Plano gratuito (V0)

Enquanto a cobrança SaaS (Fase 8 / Asaas) não está ativa para a conta, vale o limite **`FREE_PLAN_LIMIT = 1` cofre por owner**. A catraca vive no `NewVaultDialog`:

- Hook `useQuery({ queryKey: ["vaults-count", userId], head: true, count: "exact" })` calcula a contagem com 1 round-trip barato (sem trazer linhas) já filtrado pela RLS.
- O botão "Novo Cofre" deixa de ser `DialogTrigger` direto. O `onClick` chama `handleNewClick()`: se `count >= FREE_PLAN_LIMIT` **e** `!subscriptionActive`, abre um `AlertDialog` ("Limite do plano gratuito atingido") com CTA "Assinar agora" → `/configuracoes`. Assinante Pro cria cofres ilimitados.
- **Defesa em profundidade**: a `mutationFn` refaz o `count` antes do `INSERT` e aborta com mensagem amigável caso uma corrida entre abas tenha furado o guard do frontend.
- A `onSuccess` invalida `["vaults-count", userId]` além de `["vaults"]`.

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
- **`Settings → PlanCard`** (refatorado na Fase 14 — UX de Planos): card unificado intitulado **"Seu Plano"** com 3 estados visuais distintos:
  - **PayGo (default — `!isActive && !isOverdue`)**: dois blocos separados por divisor.
    - Bloco 1 — *Plano Atual: PayGo* + badge verde "Ativo". Cópia: "Sem mensalidade. Você paga apenas a taxa de 2,9% por pagamento aprovado."
    - Bloco 2 — Oferta de upgrade *PixelSafe Pro — R$ 39/mês*. Cópia: "Zere a taxa da plataforma (0%) e lucre 100% nas suas entregas." Contém o botão **Assinar Plano Pro** (chama `asaas-checkout` e abre `invoiceUrl` em nova aba) e o aviso de CPF/CNPJ obrigatório atrelado ao bloco.
  - **Pro (`isActive`)**: bloco único — *Plano Atual: Pro* + badge verde "Ativo". Cópia: "Taxa da plataforma zerada (0%). Você lucra 100% nas suas entregas." Botões: **Histórico de Faturas** (outline, abre o portal do cliente Asaas em nova aba — `sandbox.asaas.com/customerInvoices` ou `www.asaas.com/customerInvoices`) e **Cancelar Assinatura** (ghost com `text-destructive`, abre `AlertDialog` de confirmação que invoca `cancel-subscription`).
  - **Overdue (`isOverdue`)**: badge âmbar "Pagamento em atraso" + botões **Atualizar status** e **Pagar fatura** (mesmo fluxo, devolve a fatura overdue).
  - O botão **Atualizar status** (estados PayGo/Overdue) força `refetch()` após o pagamento.
- **Catraca PLG (`NewVaultDialog`)**: além do `count >= FREE_PLAN_LIMIT`, exige `!subscriptionActive`. Assinante pode criar cofres ilimitados. Botão "Assinar agora" do `AlertDialog` redireciona para `/configuracoes`. A defesa em profundidade na `mutationFn` aplica a mesma regra.
- **Banner global (`AuthenticatedLayout`)**: se `isOverdue`, renderiza barra âmbar acima do `<main>` com CTA "Regularizar" → `/configuracoes`.

### Edge Function `cancel-subscription` (`verify_jwt = true`)
Cancela in-app a assinatura PixelSafe Pro do usuário autenticado (Fase 14). Disparada pelo botão "Cancelar Assinatura" do `PlanCard` após confirmação no `AlertDialog`.
1. Valida JWT via `getClaims`. Sem claims → `401`.
2. Cliente `admin` com `SERVICE_ROLE_KEY` lê `profiles(asaas_subscription_id, subscription_status)` do owner.
3. Se `asaas_subscription_id` for null → `400 { error: "Sem assinatura ativa para cancelar." }`.
4. `DELETE {asaasBaseUrl()}/subscriptions/{id}` com header `access_token: ASAAS_API_KEY`. Status `404` é tratado como **sucesso idempotente** (assinatura já cancelada lá). Outros erros não-2xx → `502`.
5. `UPDATE profiles SET subscription_status = 'inactive' WHERE id = userId`. Mantém `asaas_subscription_id` para auditoria/histórico (não é apagado).
6. Resposta `{ success: true }`. Frontend invalida `["subscription", userId]` e dispara `refetch()` → card colapsa para o visual PayGo.
7. **Idempotência cruzada com `asaas-webhook`**: o webhook `SUBSCRIPTION_DELETED` chega depois e tenta o mesmo `UPDATE → 'inactive'`. Sem efeito colateral.

## Pendências (próximas fases)

- Validar assinatura HMAC do webhook do Mercado Pago (header `x-signature`) como camada adicional ao cross-check de `external_reference`.
- Configurar agendador externo (cron / Supabase Scheduled Trigger) para disparar `cleanup-expired-vaults` em produção, caso ainda não esteja configurado.

## Fase 9 — Identidade Visual (Ciano), Soft UI, Mobile-First e Recovery

### Nova paleta primária
- `--primary: 187 100% 43%` (Ciano ≈ `#00CEDB`).
- `--primary-foreground: 0 0% 7%` (texto escuro sobre ciano para contraste WCAG AA em botões e badges).
- `--ring: 187 100% 43%` (anéis de foco acompanham a primária).
- Tokens `--sidebar-primary` e `--sidebar-ring` espelham a primária.
- `--vault` (âmbar `#F59E0B`) permanece como cor secundária da marca (ícones de cofre).

### Soft UI
- `--radius: 0.875rem` (≈14px). Todos os componentes shadcn que herdam `var(--radius)` ficam com `rounded-xl`/`rounded-2xl` automaticamente (Card, Input, Button, Dialog, Select, etc.).
- Utilitários globais em `src/index.css`:
  - `.shadow-soft` — sombra leve para cards padrão.
  - `.shadow-soft-lg` — sombra mais difusa para cards-destaque (Login, Reset, PayVault).
  - `.shadow-soft-primary` — glow ciano sutil (reservada para uso futuro em CTAs de destaque).
- Cards do Dashboard, Clients, Settings, PayVault, EmptyVaults, VaultCard e StatsCards passaram a usar `rounded-2xl` + `shadow-soft`.

### Mobile-First
- `AppSidebar` (`src/components/AppSidebar.tsx`) foi dividido em:
  - `SidebarBody` — conteúdo reutilizável da sidebar (logo, nav, footer com avatar e logout).
  - `AppSidebar` — `<aside>` fixa com `hidden md:flex`, exibida apenas no desktop.
- `AuthenticatedLayout` (`src/layouts/AuthenticatedLayout.tsx`):
  - Em `<md`: header com botão hambúrguer abrindo `Sheet` (lado esquerdo) que monta o `SidebarBody`. Logo da marca centralizado no header mobile.
  - Em `≥md`: comportamento atual (sidebar fixa).
  - Padding responsivo: `px-4 py-6 md:px-8 md:py-8`.
- **Clients** (`src/pages/Clients.tsx`): no mobile (`<md`) lista de cards Soft UI com nome, e-mail, badge de projetos e CTA WhatsApp. No desktop mantém a `<Table>` original.
- **Dashboard**: header empilha em mobile (`flex-col gap-3 sm:flex-row`); botão "Novo Cofre" full-width em telas pequenas.
- **NewVaultDialog**: grids `grid-cols-2 → grid-cols-1 sm:grid-cols-2`; `DialogContent` com `max-h-[90vh] overflow-y-auto`.
- **Settings**: padding `p-5 sm:p-6`; `PlanCard` com layout em coluna no mobile e botões full-width.
- **PayVault**: paddings ajustados para mobile (`px-4 py-8 sm:py-10`).

### Fluxo de recuperação de senha
- **`/login`**: link "Esqueci minha senha" abaixo do botão Entrar (apenas no modo `signin`).
- **`/forgot-password`** (`src/pages/ForgotPassword.tsx`): form com 1 campo (email). Chama `supabase.auth.resetPasswordForEmail(email, { redirectTo: ${origin}/reset-password })`. Após sucesso mostra estado "Verifique seu email".
- **`/reset-password`** (`src/pages/ResetPassword.tsx`): o Supabase entrega o token no fragment (`#access_token=...&type=recovery`) e o `onAuthStateChange` (em `useAuth`) cria a sessão automaticamente. Detecta `type=recovery` no hash e mostra "Link inválido ou expirado" se a sessão de recovery não existir e o usuário não estiver logado. Form com `password` + confirmação (mín. 6 chars). Em sucesso chama `supabase.auth.updateUser({ password })` e redireciona para `/dashboard`. Limpa o hash da URL via `history.replaceState`.

### Página `/install` (PWA Experience informativa)
- Rota pública `src/pages/Install.tsx`.
- Dois cards lado a lado em desktop / empilhados em mobile com instruções:
  - **iPhone (Safari)**: Compartilhar → Adicionar à Tela de Início → Adicionar.
  - **Android (Chrome)**: menu ⋮ → Adicionar à tela inicial / Instalar app → Confirmar.
- Botão "Instalar no celular" no `Login.tsx` apontando para `/install`.
- **Importante**: ainda não há manifest PWA nem service worker shippado. Decisão consciente para evitar problemas de cache no preview do editor.

## Fase 10 — Política de Retenção

Cofres possuem uma "data de validade" dupla, controlada pela coluna `vaults.expires_at` (timestamptz, nullable), que minimiza custos de Storage do SaaS.

### Regras de negócio

- **Inadimplente (default)**: ao criar um cofre, o Postgres define automaticamente `expires_at = now() + interval '30 days'` via `DEFAULT` na coluna.
- **Pagante**: quando a Edge Function `mp-webhook` confirma o pagamento real (status `approved`), o `UPDATE` que muda `status` para `paid` também sobrescreve `expires_at` para exatamente **7 dias** a partir daquele momento.
- **Idempotência preservada**: o update continua usando `.neq("status", "paid")` para que reentregas do webhook não resetem a data.

### Comportamento da UI

- **Página pública `/pay/:slug`** (`src/pages/PayVault.tsx`):
  - Helper local `isVaultExpired(vault)` compara `new Date(expires_at) < Date.now()`.
  - Ordem de renderização: `ExpiredCard` → `SuccessCard` → `ProcessingCard` → `CheckoutCard`. Expirado tem prioridade absoluta.
  - `ExpiredCard`: card Soft UI com ícone `AlertTriangle`, título "Cofre expirado" e mensagem informando que o arquivo foi removido.
  - `CheckoutCard`: aviso "Por motivos de segurança, o arquivo ficará disponível para download por 7 dias após a confirmação do pagamento."
- **Dashboard / `VaultCard`**:
  - Helper compartilhado `isExpired(vault)` em `src/data/mockVaults.ts`.
  - Badge muda para "Expirado" em tom destructive quando `isExpired === true`.
  - Linha sutil com ícone `CalendarClock` exibe "Expira em DD/MM/AAAA" (ou "Expirou em ..." em destructive).
  - Quando expirado, ficam **desabilitados**: "Copiar link", botão WhatsApp e "Reenviar e-mail". Continua **habilitado**: "Excluir cofre".

## Fase 10.1 — Cleanup automático (`cleanup-expired-vaults`)

Edge Function pública (`verify_jwt = false`) responsável pela **deleção física** dos arquivos de cofres já expirados, complementando o bloqueio de UI da Fase 10.

### Autenticação
- Header `Authorization: Bearer ${CLEANUP_SECRET}` **ou** header `x-cleanup-secret: ${CLEANUP_SECRET}`.
- Falha de match → `401 Unauthorized`.
- Secret ausente no ambiente → `500 Server misconfigured` (fail-closed).

### Lógica
1. `SELECT id, file_path FROM vaults WHERE expires_at < now() AND file_path IS NOT NULL` (via `service_role`).
2. Para cada vault:
   - `storage.from('vault-files').remove([file_path])`.
   - `UPDATE vaults SET file_path = NULL, file_name = NULL WHERE id = ?`.
   - Falhas individuais não abortam o sweep; são acumuladas em `failures[]`.
3. Resposta: `{ cleaned_vaults, scanned, failures: [{ id, reason }] }`.

### Operação
- Disparada por **agendador externo** (cron de provedor próprio, GitHub Actions, ou Supabase Scheduled Trigger). **Não há trigger no Postgres.**
- Como `get-download-url` retorna `409` quando `file_path` é `null`, e a UI já trata `expires_at` antes, o cleanup é seguro mesmo se rodar com latência.

> Esta seção substitui o antigo "não-objetivo" da Fase 10 que afirmava ausência de deleção física automática — agora ela existe e está documentada.

## Fase 11 — Notificações ao Profissional

Objetivo: dar ao designer/profissional o "Radar do Chefe" — visibilidade em tempo real dos dois marcos críticos da entrega — sem inundar a caixa de entrada com duplicatas.

### Coluna `vaults.downloaded_at`
- `timestamptz`, nullable.
- Funciona como **gate atômico**: só a transação que conseguir `UPDATE vaults SET downloaded_at = now() WHERE id = ? AND downloaded_at IS NULL` ganha o direito de disparar o e-mail "Cliente baixou". Concorrência resolvida 100% no Postgres, sem precisar de locks distribuídos ou filas.

### Notificações enviadas

| Gatilho | Onde dispara | Assunto | CTA |
| --- | --- | --- | --- |
| Pagamento aprovado pelo MP | `mp-webhook` (após `UPDATE status='paid'` atômico) | `💸 Pix recebido: {title} ({R$ valor})` | "Ver no Dashboard" |
| Primeiro download do arquivo | `get-download-url` (dentro do bloco da trava `downloaded_at IS NULL`) | `📥 Cliente baixou: {title}` | "Ver no Dashboard" |

Ambos os e-mails:
- Vão para `profiles.email` do `owner_id` do cofre.
- São enviados via `_shared/resend.ts` (template padrão com saudação opcional pelo primeiro nome do `full_name`).
- Falha do Resend é **não-fatal** — apenas logada, sem quebrar o webhook nem o download.

### Anti-spam (decisão arquitetural)
- O e-mail "Pix recebido" só dispara após o `UPDATE ... WHERE status<>'paid'` ter retornado linha — reentregas do MP não geram duplicata.
- O e-mail "Cliente baixou" só dispara para a chamada que ganhou o gate atômico do `downloaded_at`. Cliques subsequentes em "Baixar arquivo" devolvem o `signed_url` sem novo e-mail.

### E-mail ao cliente (mantido)
O e-mail de liberação ao **cliente final** (assunto `Seu arquivo "{title}" está liberado! 🔓`) continua sendo disparado pelo `mp-webhook` como antes — a Fase 11 apenas adicionou as duas notificações ao profissional sem alterar o fluxo existente do cliente.

## Fase 12 — Rastreamento de Eventos (`vault_events`)

Log de atividades por cofre para dar visibilidade ao profissional sobre a jornada do cliente (recuperação de venda, prova social, debugging).

### Schema

Tabela `public.vault_events`:
- `id` (uuid, PK, default `gen_random_uuid()`)
- `vault_id` (uuid, FK → `vaults.id` `ON DELETE CASCADE`)
- `event_type` (text, **`CHECK IN ('page_viewed', 'checkout_started', 'payment_approved', 'downloaded')`**)
- `created_at` (timestamptz, default `now()`)
- Índice composto `(vault_id, created_at DESC)` para a Timeline.

**RLS**: SELECT apenas para o owner do cofre (via `EXISTS` em `vaults`). **Não há policies de INSERT/UPDATE/DELETE** — todos os writes acontecem via `service_role` nas Edge Functions, eliminando a possibilidade de manipulação pelo cliente.

> Decisão: usar `text + CHECK` em vez de `enum` Postgres. Permite adicionar novos tipos (ex.: `whatsapp_clicked`) com uma simples migração de constraint, sem `ALTER TYPE`.

### Tipos de evento e onde são gravados

| `event_type` | Disparo | Origem |
| --- | --- | --- |
| `page_viewed` | Cliente abre `/pay/:slug` | Frontend → `log-vault-event` (público, com dedupe 60s) |
| `checkout_started` | Clique em "Pagar e Liberar Arquivo" | Frontend → `log-vault-event` (antes do redirect ao MP) |
| `payment_approved` | Webhook MP confirma `approved` | Backend `mp-webhook` (após `UPDATE` atômico) via `_shared/events.ts` |
| `downloaded` | Primeiro download do arquivo | Backend `get-download-url` (dentro do bloco da trava `downloaded_at IS NULL`) via `_shared/events.ts` |

### Edge Function `log-vault-event` (`verify_jwt = false`)

Endpoint público para os dois eventos passivos do lado do cliente.

1. Body validado por Zod: `{ vault_id: uuid, event_type: 'page_viewed' | 'checkout_started' }`. **Allowlist no servidor**: `payment_approved` e `downloaded` são rejeitados (400) — só o backend pode gravá-los, evitando spoofing de "pagamento aprovado" pelo cliente.
2. Verifica que o `vault_id` existe; se não, retorna `200 ok` sem inserir (não vaza informação).
3. **Dedupe de 60s** por `(vault_id, event_type)`: se houver evento idêntico em janela de 60s, retorna `{ ok: true, deduped: true }` sem inserir.
4. Insert via `service_role`. Sempre responde 200 (silencioso em erro de DB).

### Frontend

- **`src/lib/events.ts`** → `logVaultEvent(vaultId, eventType)`: wrapper fire-and-forget sobre `supabase.functions.invoke('log-vault-event', ...)`. Nunca lança.
- **`PayVault.tsx`**:
  - `useEffect + useRef` (`viewedRef`) dispara `page_viewed` uma única vez por cofre/sessão (guard contra Strict Mode duplicar). Só dispara quando o cofre existe, não está expirado e não está pago.
  - `payMutation.mutationFn` chama `logVaultEvent(vault.id, 'checkout_started')` antes do `invoke('create-payment')`.
- **`src/components/VaultTimeline.tsx`**: lê `vault_events` filtrando por `vault_id` ordenado `created_at DESC`. Lista vertical com guia (border-left), ícone circular semântico por tipo e timestamp relativo (`date-fns/formatDistanceToNow` em `pt-BR`). Empty state amigável.

  | Evento | Ícone (lucide) | Cor (token) |
  | --- | --- | --- |
  | `page_viewed` | `Eye` | `text-muted-foreground` |
  | `checkout_started` | `ShoppingCart` | `text-primary` |
  | `payment_approved` | `CheckCircle2` | `text-success` |
  | `downloaded` | `Download` | `text-vault` |

- **`VaultCard.tsx`**: item no `DropdownMenu` — **"Ver histórico"** (ícone `History`) abre um `Dialog` com `<VaultTimeline vaultId={vault.id} />`.

### Custos / performance

- 1 INSERT por evento; `vault_events` é write-light, read-light (só consultado quando o owner abre o histórico).
- O dedupe de 60s no `log-vault-event` adiciona 1 SELECT barato por chamada (indexado por `(vault_id, created_at DESC)`).
- Sem polling: a Timeline é re-buscada apenas quando o `Dialog` abre.

## Fase 13 — Marketplace OAuth e Split Dinâmico

A partir desta fase o PixelSafe opera como **plataforma marketplace** do Mercado Pago. O profissional não cola mais o Access Token manualmente — ele autoriza o PixelSafe via OAuth — e a plataforma retém uma comissão dinâmica por venda.

### 13.1 OAuth do Mercado Pago

**Variáveis de ambiente / secrets envolvidos:**
- Frontend (`.env`): `VITE_MP_CLIENT_ID` (Client ID público do app no MP), `VITE_PUBLIC_APP_URL`.
- Backend (Supabase secrets): `MP_CLIENT_ID`, `MP_CLIENT_SECRET`, `PUBLIC_APP_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

**Tabela `workspaces` — colunas adicionadas:** `mp_refresh_token`, `mp_public_key`, `mp_user_id`. A coluna legada `mp_access_token` continua existindo e é a chave usada por `create-payment` e `mp-webhook` para autenticar requisições no MP.

**Frontend (`Settings → MercadoPagoCard`):**
- Quando **não conectado**: botão "Conectar Mercado Pago" redireciona (`window.location.href`) para
  `https://auth.mercadopago.com.br/authorization?client_id=${VITE_MP_CLIENT_ID}&response_type=code&platform_id=mp&state=${user.id}&redirect_uri=${VITE_SUPABASE_URL}/functions/v1/mp-oauth-callback`.
- O `state` carrega o `auth.uid()` do usuário logado (correlaciona o callback ao workspace correto).
- Quando **conectado**: badge verde com `CheckCircle2`, prefixo/sufixo do `mp_user_id` e botão "Reconectar" que reinicia o fluxo OAuth.
- Ao montar a página, lê `?mp_connected=true|false` da URL e exibe um toast (sucesso ou erro), depois remove o param via `history.replaceState`.

**Edge function `mp-oauth-callback` (`verify_jwt = false`):**
1. Lê `code`, `state` e `error` da query string. Se faltar algo, redireciona para `${PUBLIC_APP_URL}/configuracoes?mp_connected=false`.
2. POST `https://api.mercadopago.com/oauth/token` com `grant_type=authorization_code`, `client_id`, `client_secret`, `code` e `redirect_uri` (mesma URL pública desta função). Body codificado como `application/x-www-form-urlencoded`.
3. Usa um Supabase client com **service_role** para `UPDATE workspaces SET mp_access_token, mp_refresh_token, mp_public_key, mp_user_id WHERE owner_id = state`.
4. Redireciona para `${PUBLIC_APP_URL}/configuracoes?mp_connected=true` em caso de sucesso, ou `mp_connected=false` em qualquer falha. Erros são logados (`console.error`) sem expor detalhes ao usuário.

> **Nota de segurança**: a função é `verify_jwt = false` porque o MP redireciona o navegador (sem header `Authorization`). A confiança é estabelecida pelo par `(code, redirect_uri)` validado pelo MP e pelo `state` (UID do dono) — só o próprio usuário enxerga seu UID na URL gerada localmente. O token só é gravado se o `state` corresponder a um `workspaces.owner_id` válido.

### 13.2 Split Dinâmico (`create-payment`)

A regra de comissão da plataforma agora é calculada por venda, em função do plano do **dono do cofre** (não do cliente final).

1. Após carregar o `vault`, busca `profiles.subscription_status WHERE id = vault.owner_id`.
2. Calcula:
   - **Plano Pro ativo** (`subscription_status === 'active'`): `marketplace_fee = 0` (assinatura Asaas já cobre a plataforma).
   - **PayGo (qualquer outro status)**: `marketplace_fee = round(price * 0.029, 2)`.
3. O campo `marketplace_fee` é incluído no body do `POST https://api.mercadopago.com/checkout/preferences`. O `Authorization: Bearer` continua sendo o `mp_access_token` do workspace do **dono do cofre** — o MP debita a comissão do recebimento do vendedor e credita na conta do app (PixelSafe) automaticamente.

### 13.3 Pontos de atenção operacionais

- A `redirect_uri` (`${SUPABASE_URL}/functions/v1/mp-oauth-callback`) precisa estar registrada nas configurações do app no Mercado Pago.
- Em ambientes de preview do Lovable, `PUBLIC_APP_URL` aponta para o domínio de produção (`https://app.pixelsafe.com.br`); o usuário será redirecionado para lá ao final do OAuth.
- O `mp_refresh_token` ainda não é consumido por nenhuma function — está armazenado para uso futuro (renovação automática quando o `mp_access_token` expirar).
