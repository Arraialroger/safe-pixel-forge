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

Todas em `supabase/functions/`. Configuradas com `verify_jwt = false` em `supabase/config.toml` (rotas públicas chamadas por visitantes anônimos ou pelo Mercado Pago).

### `create-payment`
Entrada: `{ vault_id: uuid }`. Fluxo:
1. Valida body (Zod).
2. Cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS).
3. Busca vault por `id`. Rejeita se já `paid`.
4. Busca `mp_access_token` em `workspaces` pelo `owner_id` do vault.
5. `POST https://api.mercadopago.com/checkout/preferences` com `items`, `external_reference = vault.id`, `back_urls`, `auto_return: "approved"` e `notification_url = ${SUPABASE_URL}/functions/v1/mp-webhook?vault_id=${vault.id}`.
6. Retorna `{ init_point, preference_id }`.

No frontend (`PayVault.tsx`), o botão chama `supabase.functions.invoke('create-payment')` e redireciona via `window.location.href = init_point`.

### `mp-webhook`
Endpoint público chamado pelo Mercado Pago após o pagamento. Sempre responde `200` (mesmo em erro) para evitar reentrega infinita.
1. Lê `vault_id` da query string.
2. `UPDATE vaults SET status='paid' WHERE id=vault_id AND status<>'paid' RETURNING title, client_email, public_slug` — idempotente.
3. Se houve mudança e há `client_email`, dispara e-mail via Resend (`POST https://api.resend.com/emails`):
   - From: `PixelSafe <suporte@pixelsafe.com.br>`
   - Subject: `Seu arquivo "{title}" está liberado! 🔓`
   - HTML inline com CTA para `${PUBLIC_APP_URL}/pay/${public_slug}` (fallback para a URL publicada do Lovable).

### `get-download-url`
Entrada: `{ slug: string }`. Fluxo:
1. Busca o vault pelo `public_slug`.
2. Se `status !== 'paid'` → `403`.
3. Gera Signed URL de **15 minutos** (`vault-files`, `createSignedUrl(file_path, 900)`).
4. Retorna `{ signed_url }`. O frontend abre em nova aba.

### Variáveis de ambiente (Edge Functions)
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (gerenciadas).
- `RESEND_API_KEY` (configurada).
- `PUBLIC_APP_URL` (opcional, fallback hardcoded para a URL publicada).

## Pendências (próximas fases)

- Substituir mock da página de Configurações por persistência real do `mp_access_token` em `workspaces`.
- Validar assinatura/origem do webhook do Mercado Pago (consultar `/v1/payments/{id}` com o `access_token` do owner).
- Reenvio manual do e-mail de liberação a partir do dashboard.
