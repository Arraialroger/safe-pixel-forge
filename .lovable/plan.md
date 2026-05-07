## Fase 14 — Trust & Transparency UX

### 1. Banco de dados (migration)
- `ALTER TABLE public.vaults ADD COLUMN allowed_payment_methods text NOT NULL DEFAULT 'all'`
- Constraint check: valor deve ser `'all'` ou `'pix'`.

### 2. `NewVaultDialog.tsx`
- **Remover** o campo `status` do schema Zod, do `defaultValues`, do `<FormField>` e do payload do INSERT (status agora cai no default `'pending'` da tabela).
- **Adicionar** ao schema Zod:
  - `allowed_payment_methods: z.enum(["pix", "all"]).default("pix")`
- **Adicionar** `RadioGroup` (shadcn) abaixo do campo Valor:
  - "Apenas Pix" — Recomendado, taxas menores, aprovação instantânea → `pix`
  - "Pix, Boleto e Cartão" — sujeito a taxas de parcelamento → `all`
- **Bloco "Simulação de recebimento"** (componente local), reativo a `price_masked`:
  - Lê `useSubscription().isActive`.
  - PayGo: linha "Valor", "Taxa PixelSafe (2,9%) — R$ X,XX *(Zere esta taxa com o Plano Pro)*", "Taxa Mercado Pago: variável conforme prazo", "Você recebe: ~ R$ Y".
  - Pro: "Taxa PixelSafe: R$ 0,00 (Plano Pro ✨)".
- INSERT passa a enviar `allowed_payment_methods: values.allowed_payment_methods` (sem `status`).

### 3. `Settings.tsx` — microcopy de transparência
- Em `MercadoPagoCard`, antes do bloco conectado/conectar, renderizar um `<Alert>` (variant default, ícone `Info` do lucide) com o texto exato pedido pelo usuário sobre como funcionam as taxas.

### 4. Edge Function `create-payment`
- Buscar `allowed_payment_methods` no SELECT do vault.
- Se `=== 'pix'`, adicionar ao `preferenceBody`:
  ```ts
  payment_methods: {
    excluded_payment_types: [
      { id: "credit_card" },
      { id: "ticket" },
    ],
  }
  ```
- Sem mudança quando `=== 'all'`.

### 5. Documentação `docs/TECH_SPEC.md`
- Nova seção **Fase 14 — Trust & Transparency**:
  - Coluna `vaults.allowed_payment_methods` (default `'all'`, valores `'pix' | 'all'`).
  - Comportamento da `create-payment` com `excluded_payment_types`.
  - Novo fluxo do `NewVaultDialog` (sem campo Status, com seletor de meio de pagamento e simulador).
  - Microcopy de taxas no `MercadoPagoCard`.
- Verificar/atualizar a seção da última implementação (Manifest PWA + ícones) — já está documentada; só revisar redação se necessário.

### Detalhes técnicos
- `RadioGroup` já existe em `src/components/ui/radio-group.tsx`.
- `Alert` já existe em `src/components/ui/alert.tsx`.
- Tipos do Supabase serão regenerados automaticamente após a migration; o código usa `allowed_payment_methods` no insert/select.
- Cálculo do simulador: `fee = isActive ? 0 : Math.round(price * 0.029 * 100) / 100; net = price - fee` — consistente com a lógica já presente em `create-payment`.
- Não mexer em outros arquivos (PayVault, Dashboard, etc.).

### Arquivos afetados
- migration SQL (nova)
- `src/components/NewVaultDialog.tsx`
- `src/pages/Settings.tsx`
- `supabase/functions/create-payment/index.ts`
- `docs/TECH_SPEC.md`
