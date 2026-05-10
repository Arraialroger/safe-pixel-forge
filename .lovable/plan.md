## Ajustes Finos da Fase 16

Duas melhorias de UX, 100% frontend, sem mudanças de schema, edge functions ou queries.

### 1. Botão "Copiar Comprovante" no `VaultTimeline.tsx`

No bloco verde do `digital_signature_accepted` (já existente), adicionar um botão discreto (ghost, `size="sm"`, ícone `Copy` da `lucide-react`) no canto superior direito do header da seção.

Para construir o texto, preciso do nome do projeto (`vault.title`), que hoje **não chega ao componente**. Solução: estender as props de `VaultTimeline` para aceitar `vaultTitle?: string` (opcional, fallback para "—") e passar a prop nos call-sites (procuro com `rg "VaultTimeline"` na hora; provável uso em `Dashboard.tsx`/`VaultCard.tsx`).

Ao clicar:
- Monta o texto:
  ```
  🛡️ Comprovante de Entrega - PixelSafe
  Projeto: {vaultTitle}
  Data e Hora: {format(created_at, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
  Endereço IP: {metadata.ip ?? "—"}
  Dispositivo: {truncate(metadata.user_agent, 80)}
  ```
- `await navigator.clipboard.writeText(...)` com try/catch.
- Sucesso → `toast.success("Comprovante copiado!", { description: "Cole no WhatsApp do cliente." })` (sonner, padrão já usado no projeto).
- Falha → `toast.error("Não foi possível copiar.")`.

Linhas omitidas do user_agent são truncadas com helper local (`s.length > 80 ? s.slice(0,80) + "…" : s`).

### 2. Busca + Ordenação no `Clients.tsx`

Adicionar uma barra superior (acima do `<Accordion>`) com layout responsivo (`flex flex-col sm:flex-row gap-2`):

- **Input de busca** (`@/components/ui/input`, ícone `Search` à esquerda, placeholder "Buscar por nome, e-mail ou WhatsApp"). Estado: `const [search, setSearch] = useState("")`.
- **Select de ordenação** (`@/components/ui/select`, largura ~200px). Estado: `const [sortBy, setSortBy] = useState<"recent" | "revenue" | "conversion">("recent")`. Opções:
  - `recent` → "Mais recentes" (padrão, ordena por `lastCreatedAt` desc — comportamento atual de fato é por receita; trocaremos o default para `lastCreatedAt`)
  - `revenue` → "Maior receita" (`totalReceived` desc)
  - `conversion` → "Maior conversão" (`conversionRate` desc, desempate por `totalCount` desc)

Refatorar o `useMemo` atual: a agregação continua igual, mas o `.sort(...)` final passa a depender de `sortBy`. Adicionar um segundo `useMemo` derivado (`filteredClients`) que aplica o filtro:

```ts
const q = search.trim().toLowerCase();
if (!q) return clients;
const digits = q.replace(/\D/g, "");
return clients.filter(c =>
  c.clientName.toLowerCase().includes(q) ||
  c.email.toLowerCase().includes(q) ||
  (digits && c.clientWhatsapp && onlyDigits(c.clientWhatsapp).includes(digits))
);
```

Renderizar a partir de `filteredClients`. Quando vazio com busca ativa, mostrar estado vazio leve ("Nenhum cliente encontrado para '{search}'.").

### Out of scope (explicitamente)

- Não alteramos schema, edge functions, RLS, nem `useQuery`.
- Sem botões de mock/simulação.
- Sem mudanças no header já existente do bloco de comprovante além do botão.

### Arquivos tocados

- `src/components/VaultTimeline.tsx` (nova prop + botão copiar)
- Call-sites de `VaultTimeline` (passar `vaultTitle`) — identificados em build via `rg`
- `src/pages/Clients.tsx` (barra de busca/sort + memos)
