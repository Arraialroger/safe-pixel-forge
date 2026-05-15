
# Auditoria Estratégica — Pivot Minimalista PixelSafe

Análise crítica como CTO/Lead Product Architect antes de qualquer execução. **Concordo a ~85%** com o caminho — há 3 ressalvas a incorporar.

---

## 1. UX & Retenção

**Tese central correta.** "Metade de um produto incrível" é o caminho no estágio atual. O editor de vídeo não quer CRM; quer receber Pix e ter sossego.

**Empty State em 3 passos:** ✅ correto. Melhor que tooltips/tours porque tooltips assumem interface já preenchida e tours são abandonados em 70%+ dos casos.

**Success State pós-criação:** ✅ correto, **com refinamentos:**
- Não "transformar" o modal — usar *steps* dentro do mesmo `Dialog` (form → uploading → success) com transição suave.
- CTA primário deve ser **WhatsApp** (maior taxa de abertura no Brasil), não "Copiar link".
- Adicionar micro-conquista: badge "Cofre #N criado" — ativa dopamina e justifica a `/conquista/:id` que já existe.
- **Toast persistente** (sonner `duration: Infinity` + ação) por ~10s após fechar o modal, com "Compartilhar agora no WhatsApp". Cobre quem fecha o modal por reflexo.

---

## 2. Impacto Técnico & Performance

| Métrica | Antes | Depois | Ganho |
|---|---|---|---|
| Rotas autenticadas | 4 | 2 | -50% |
| Queries duplicadas (`vaults` em Dashboard + Vaults) | 2× | 1× | -50% chamadas |
| LOC removidas (Clients=386 + Dashboard ~100 + helpers) | ~1.200 | — | menos surface bug |

**Estrutura para a página principal não virar arquivo de 1000 linhas:**

```text
src/pages/Home.tsx                 # ~120 linhas — só orquestra
src/features/vaults/
├── VaultsList.tsx
├── VaultRow.tsx                   # já existe
├── VaultsEmptyState.tsx           # 3 passos educativos
├── VaultsHeader.tsx
├── stats/StatsCards.tsx           # movido
└── new/
    ├── NewVaultDialog.tsx         # multi-step orquestrador
    ├── steps/FormStep.tsx
    ├── steps/UploadStep.tsx
    └── steps/SuccessStep.tsx
```

Regra: nenhum arquivo > **300 linhas**. `NewVaultDialog` atual tem **804** — dívida técnica óbvia que deve ser quebrada nesta fase.

---

## 3. Escalabilidade da Linha no Mobile

A solução atual em `VaultRow.tsx` (desktop = grid 6-col / mobile = card vertical com 5 botões em grid 2-col) está **correta**. Para escalar:

- Máx **5 ações por linha**. Ações futuras vão para menu `…` apenas no desktop.
- Touch targets ≥ 44px no mobile (atualmente `h-9` = 36px; subir para `h-10` se métricas indicarem).
- **Não tornar a linha inteira clicável** — qual seria a ação default? Manter clique apenas nos ícones.

---

## 4. Pontos Cegos (o que perdemos)

1. **CRM removido → "quem é meu melhor cliente"**
   - Impacto: baixo no MVP, médio em 6 meses.
   - Mitigação: agrupar visualmente cofres por e-mail quando 2+ do mesmo cliente (cabeçalho colapsável). ~30 linhas. Preserva 80% do valor.

2. **HelpCenter removido → suporte vai inflar**
   - Mitigação: tab `Settings > Ajuda` com 5–7 perguntas críticas (Pix demora?, Como saco?, Cliente não recebeu, Cancelar plano, Reembolso). Link `?` contextual no header do Home.

3. **Dashboard removido → perde "tendência"**
   - Sem regressão real: gráfico temporal nunca existiu. Os 3 StatsCards vão para o topo do Home. ✅

4. **Página `/conquista/:id`** — manter e linkar pelo Success State.

5. **Risco SEO/landing** — `/` precisa ficar livre para landing pública futura; não tornar `/` a Home autenticada diretamente.

---

## 5. Arquitetura Final

### Rotas

```text
PÚBLICAS
/                          → Index (redirect: logado→/app, deslogado→/login)
/login /forgot-password /reset-password /install
/pay/:slug                 → PayVault
/conquista/:id             → Achievement

AUTENTICADAS (AuthenticatedLayout)
/app                       → Home (lista + stats + empty/success)
/configuracoes             → Settings (tabs: Perfil | Plano | Mercado Pago | Ajuda)
```

> Uso `/app` em vez de `/` para a Home autenticada para preservar `/` como landing pública futura (essencial para GTM real). Custo: 1 redirect.

### Árvore enxuta

```text
src/
├── pages/
│   ├── Index.tsx            # mantido (redirect)
│   ├── Home.tsx             # NOVO — substitui Dashboard+Vaults+Clients
│   ├── Settings.tsx         # refatorado em tabs
│   ├── Login / ForgotPassword / ResetPassword / Install
│   ├── PayVault / Achievement / NotFound
├── features/
│   ├── vaults/              # ver árvore acima
│   └── settings/
│       ├── ProfileTab.tsx
│       ├── PlanTab.tsx
│       ├── MercadoPagoTab.tsx
│       └── HelpTab.tsx
├── components/              # ui genérico (shadcn + sidebar/logo)
└── hooks/                   # useAuth, useVaultActions, useSubscription, useBranding
```

### Arquivos a deletar

```text
src/pages/Dashboard.tsx
src/pages/Vaults.tsx        # mesclado em Home
src/pages/Clients.tsx
src/components/VaultRecentItem.tsx
```

### Sidebar

Manter no desktop (familiaridade). No mobile, com 2 itens, considerar header simples sem hamburger (reavaliar após implementar).

---

## Veredito

**Sim, prossiga.** Três ressalvas obrigatórias antes de cortar código:

1. ✋ Use **`/app`** para a Home autenticada, não `/`. Preserva landing futura.
2. ✋ Quebre o **`NewVaultDialog` (804 linhas) em sub-componentes** nesta fase — é pré-requisito para o Success State funcionar bem.
3. ✋ Não delete o HelpCenter sem **migrar 5–7 FAQs** para `Settings > Ajuda`.

Aprovado isto, próximo passo é eu propor o **plano de execução faseado** (3 PRs: estrutura+rotas, refactor do dialog em steps, settings com tabs) para aprovação individual.
