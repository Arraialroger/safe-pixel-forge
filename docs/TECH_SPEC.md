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
1. Form validado por Zod (`title`, `client_name`, `client_email`, `client_whatsapp?`, `price`, `status`).
2. Insere linha em `vaults`.
3. Se houver arquivo, faz upload em `vault-files` no path `${user.id}/${vault.id}/${nome}`; em caso de erro, faz rollback do insert.
4. Atualiza `file_path` e `file_name`. Invalida `["vaults"]`.

## Fluxo de Compartilhamento (`VaultCard`)

- **Copiar link**: copia `${origin}/pay/${public_slug}` para o clipboard.
- **WhatsApp**: abre `https://wa.me/{numero}?text={texto}`. Se `client_whatsapp` preenchido → `55{digits}`; caso contrário, sem destinatário.
- **Excluir**: remove arquivo do storage (best-effort) e a linha em `vaults`. Confirmação via `AlertDialog`.

## Pagamento — Edge Function `create-payment`

`supabase/functions/create-payment/index.ts`

Entrada: `{ vault_id: uuid }`. Fluxo:
1. Valida body (Zod).
2. Cliente Supabase com `SUPABASE_SERVICE_ROLE_KEY` (bypassa RLS).
3. Busca vault por `id`. Rejeita se já `paid`.
4. Busca `mp_access_token` em `workspaces` pelo `owner_id` do vault.
5. `POST https://api.mercadopago.com/checkout/preferences` com `items`, `external_reference = vault.id`, `back_urls` e `auto_return: "approved"`.
6. Retorna `{ init_point, preference_id }`.

No frontend (`PayVault.tsx`), o botão chama `supabase.functions.invoke('create-payment')` e redireciona via `window.location.href = init_point`.

## Pendências (próximas fases)

- **Fase 5**: webhook do Mercado Pago → atualizar `vaults.status = 'paid'`; geração de signed URL para download do arquivo após confirmação.
- Substituir mock da página de Configurações por persistência real do `mp_access_token` em `workspaces`.
- E-mail/notificação ao cliente quando pago.
