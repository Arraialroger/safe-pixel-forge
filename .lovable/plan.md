
# Fase 18 — Central de Gestão de Cofres

## 1. Nova página `src/pages/Vaults.tsx` (rota `/cofres`)

Layout de **lista de alta densidade**, largura total, com header (título + botão `NewVaultDialog`) e `StatsCards` no topo.

### Linha da lista (desktop ≥ md)

Grid em 7 colunas com altura compacta (~64px), divisórias `border-b border-border`, hover sutil:

```text
[Status badge] [Job + Cliente] [R$ valor] [Criado em] [Expira em] [Assinatura] [Ações]
```

- **Status**: badge semântico — Pago (success), Pendente (primary), Expirado (destructive), Expirando (amber). Reaproveita lógica de `isExpired` / `isExpiringSoon`.
- **Job/Projeto**: `font-semibold text-sm` na primeira linha; **Cliente** em `text-xs text-muted-foreground` abaixo.
- **Financeiro**: `formatBRL(price)`, `font-semibold tabular-nums`.
- **Datas**: `created_at` e `expires_at` formatados em pt-BR, `text-xs text-muted-foreground`.
- **Assinatura Digital**: se `vault_events` tiver `digital_signature_accepted`, mostra badge `ShieldCheck` "Entrega assinada · IP xxx.xxx.xxx.xxx" (lê `metadata.ip`).
- **Ações** (à direita, `flex gap-1.5`, sem dropdown):
  - `Histórico` (HistoryIcon) — abre `Dialog` com `VaultTimeline`
  - `Reenviar` (Mail) — `resend-vault-email`
  - `WhatsApp` (MessageCircle, verde) — abre `wa.me`
  - `Copiar link` (Link2 / Check após copiar) — `/pay/:slug`
  - `Excluir` (Trash2, ghost destructive) — `AlertDialog` de confirmação
  - Todos: `Button variant="ghost" size="sm"` com `Icon` + `<span class="text-xs">label</span>`. Desabilitados quando `expired` (exceto Histórico/Excluir).

### Mobile (< md)

A lista vira **cards verticais empilhados** (mesmos dados, sem dropdown):
- Topo: status + job + cliente
- Meio: valor + datas + badge de assinatura
- Base: grid 2 colunas com TODOS os botões de ação visíveis (ícone + texto curto)

### Dados

- `useQuery(["vaults", uid])` igual ao Dashboard atual.
- Para a coluna de assinatura: `useQuery(["vault-signatures", uid])` que faz `select("vault_id, metadata").eq("event_type","digital_signature_accepted")` filtrado por vaults do owner. Mapa `vaultId → { ip }` consumido pela linha.
- Estados: `isLoading` → skeleton de linhas (8 placeholders); `isError` → mensagem; vazio → reaproveita `EmptyVaults`.

## 2. Dashboard enxuto (`src/pages/Dashboard.tsx`)

Remove a grid de `VaultCard`. Mantém:
1. Header (título + `NewVaultDialog`)
2. `StatsCards` (já existe)
3. **CTA grande**: card destacado com `Button` "Ver todos os cofres" → `navigate("/cofres")`
4. **Cofres recentes** (últimos 3): lista minimalista de 3 linhas (status badge · título · cliente · valor · link "abrir histórico"). Sem cards grandes. Link "ver todos" no rodapé do bloco.

`EmptyVaults` continua aparecendo quando `vaults.length === 0`.

## 3. Roteamento e navegação

- `src/App.tsx`: adiciona `<Route path="/cofres" element={<Vaults />} />` dentro do `AuthenticatedLayout`.
- `src/components/AppSidebar.tsx`: insere item **Cofres** (ícone `Lock` ou `Archive`) entre Dashboard e Clientes.

## 4. Reutilização

- `VaultCard.tsx` permanece (usado pelo bloco "Recentes" do Dashboard? — **não**: criamos um `VaultRecentItem` minimalista inline ou pequeno componente em `src/components/VaultRecentItem.tsx` para evitar reuso do card grande).
- Lógica de mutações (`resend`, `delete`, `copy`, `whatsapp`) será extraída para um hook compartilhado `src/hooks/useVaultActions.ts` consumido por `Vaults.tsx` (e futuramente por outros lugares). `VaultCard.tsx` pode ser removido se não tiver mais consumidores — verificar e excluir.

## Detalhes técnicos

- Sem alterações de schema; consulta `vault_events` reutiliza RLS existente (owner via join — fazemos via `vaults!inner(owner_id)` no select ou filtro `vault_id IN (...)` após carregar vaults).
- Tokens semânticos do design system para todas as cores (success, destructive, primary, amber via `text-amber-600`).
- Acessibilidade: cada botão de ação tem `aria-label`; linha inteira não é clicável (evita conflitos com botões).
- Sem mudanças em edge functions, banco ou tipos gerados.

## Arquivos

**Novos**
- `src/pages/Vaults.tsx`
- `src/hooks/useVaultActions.ts`
- `src/components/VaultRow.tsx` (linha desktop + card mobile, responsivo internamente)
- `src/components/VaultRecentItem.tsx`

**Editados**
- `src/App.tsx` (rota)
- `src/components/AppSidebar.tsx` (link)
- `src/pages/Dashboard.tsx` (remoção dos cards, CTA, recentes)

**Possivelmente removido**
- `src/components/VaultCard.tsx` (se nenhum outro consumidor após a mudança)
