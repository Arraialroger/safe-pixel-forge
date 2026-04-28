# Fase 4 — Geração de Pagamento no Mercado Pago

Objetivo: ao clicar em "Pagar e Liberar Arquivo" na tela pública, criar uma preferência de pagamento no Mercado Pago via Edge Function e redirecionar o cliente para o `init_point`.

## 1. Edge Function `create-payment`

Arquivo: `supabase/functions/create-payment/index.ts`

Configuração: pública (sem JWT) — é chamada por visitantes anônimos da página `/pay/:slug`. Validação por dados do cofre, não por auth.

Fluxo:
1. CORS + handler `OPTIONS`.
2. Valida o body com Zod: `{ vault_id: string (uuid) }`.
3. Cria client Supabase com `SUPABASE_SERVICE_ROLE_KEY` (precisa ler `workspaces.mp_access_token`, que tem RLS restrita ao dono).
4. Busca o cofre: `id, owner_id, title, price, status, public_slug`.
   - 404 se não existir.
   - 409 se `status === 'paid'` (já liberado).
5. Busca `mp_access_token` em `workspaces` por `owner_id`.
   - 400 com mensagem clara se ausente: "Vendedor ainda não conectou o Mercado Pago."
6. `POST https://api.mercadopago.com/checkout/preferences` com header `Authorization: Bearer <mp_access_token>` e body:
   ```json
   {
     "items": [{
       "title": vault.title,
       "quantity": 1,
       "currency_id": "BRL",
       "unit_price": Number(vault.price)
     }],
     "external_reference": vault.id,
     "back_urls": {
       "success": `${origin}/pay/${vault.public_slug}?status=success`,
       "failure": `${origin}/pay/${vault.public_slug}?status=failure`,
       "pending": `${origin}/pay/${vault.public_slug}?status=pending`
     },
     "auto_return": "approved"
   }
   ```
   `origin` = `req.headers.get('origin')` com fallback seguro.
7. Se MP responder erro, loga e retorna 502 com mensagem genérica.
8. Sucesso: retorna `{ init_point, preference_id }`.

Sem webhook nesta fase (Fase 5).

## 2. Frontend — `src/pages/PayVault.tsx`

- Selecionar também `id` no query da `vaults` (hoje só pega title/client_name/price/status/public_slug).
- Adicionar `useMutation` que chama `supabase.functions.invoke("create-payment", { body: { vault_id: vault.id } })`.
- Botão "Pagar e Liberar Arquivo":
  - `disabled` quando `isPaid || mutation.isPending`.
  - Mostra `<Loader2 className="animate-spin" />` + "Redirecionando..." durante `isPending`.
  - `onSuccess`: `window.location.href = data.init_point`.
  - `onError`: toast destrutivo "Não foi possível iniciar o pagamento. Tente novamente em instantes."
- Remover o toast atual de "Em breve".

## 3. Pré-requisitos / observações ao usuário

- A função usa `SUPABASE_SERVICE_ROLE_KEY` (já existe nos secrets — nada a configurar).
- O dono do cofre precisa ter um registro em `workspaces` com `mp_access_token` preenchido. Ainda não há UI para isso (Settings é mock). Para testar agora, o token pode ser inserido manualmente via SQL. Em fase futura adicionaremos a tela de conexão.
- Webhook de confirmação fica para a Fase 5 — após pagar, o `status` do cofre não muda automaticamente ainda.

## Detalhes técnicos

- Stack: Deno edge function + `npm:zod`.
- CORS: usar `corsHeaders` de `@supabase/supabase-js/cors` em todas as respostas (incluindo erros).
- Tipo do retorno tipado no client via cast simples: `const { data, error } = await supabase.functions.invoke<{ init_point: string }>(...)`.
- Não armazenar nenhum dado novo no DB nesta fase.

## Arquivos afetados

- novo: `supabase/functions/create-payment/index.ts`
- editado: `src/pages/PayVault.tsx`
