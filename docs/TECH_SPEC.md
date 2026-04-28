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
Dados estendidos do usuário autenticado.
- `id` (uuid, PK), `full_name`, `email`, `custom_logo_url`, `created_at`
- **RLS**: cada usuário gerencia apenas o próprio registro (`id = auth.uid()`).

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
Configurações por dono — guarda credenciais sensíveis do vendedor.
- `id` (uuid, PK), `owner_id`, `mp_access_token`, `created_at`
- **RLS**: owner-only (`owner_id = auth.uid()`).

### Storage
- Bucket **`vault-files`** (privado). Layout: `${user_id}/${vault_id}/${nome_seguro}`.

## Rotas

| Rota | Acesso | Descrição |
| --- | --- | --- |
| `/` | público | Landing |
| `/login` | público | Autenticação Supabase |
| `/pay/:slug` | público | Checkout do cofre pelo `public_slug` |
| `/dashboard` | autenticado | Lista de cofres do owner |
| `/configuracoes` | autenticado | Configurações (mock — Mercado Pago) |
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
- **WhatsApp**: abre `https://wa.me/{numero}?text={texto}`. Se `client_whatsapp` preenchido → `55{digits}`; caso contrário, sem destinatário.
- **Excluir**: remove arquivo do storage (best-effort) e a linha em `vaults`. Confirmação via `AlertDialog`.

## Pagamento — Edge Functions

Em `supabase/functions/`. Configuração de auth em `supabase/config.toml`:
- `create-payment`, `mp-webhook`, `get-download-url` → `verify_jwt = false` (rotas públicas / chamadas pelo Mercado Pago).
- `send-vault-created` → `verify_jwt = true` (somente o dono autenticado dispara).

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

### Variáveis de ambiente (Edge Functions)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (gerenciadas).
- `RESEND_API_KEY` (configurada).
- `PUBLIC_APP_URL` (opcional, fallback hardcoded para a URL publicada).

## Estados da página `/pay/:slug`

A página lê o status do cofre no Supabase + o query param `?status=` adicionado pelas `back_urls` do MP. Decisão:

| Estado do cofre | `?status=` na URL | UI renderizada |
| --- | --- | --- |
| `paid` | qualquer | **SuccessCard** (verde, botão "Baixar arquivo") |
| `pending` | `pending` / `in_process` / `in_mediation` | **ProcessingCard** (âmbar, sem botão de pagar; faz polling a cada 10s para flipar quando o webhook confirmar) |
| `pending` | ausente / outro | **CheckoutCard** (botão "Pagar e Liberar Arquivo") |

A `ProcessingCard` exibe a mensagem: _"Recebemos o seu pedido! Estamos aguardando a confirmação do Mercado Pago. Assim que o pagamento for processado (boletos podem levar até 2 dias úteis), o arquivo será liberado aqui e enviaremos um aviso para o seu e-mail."_

## Pendências (próximas fases)

- Substituir mock da página de Configurações por persistência real do `mp_access_token` em `workspaces`.
- Validar assinatura HMAC do webhook do Mercado Pago (header `x-signature`) como camada adicional ao cross-check de `external_reference`.
- Reenvio manual do e-mail de liberação / criação a partir do dashboard.

