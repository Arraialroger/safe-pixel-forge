## Diagnóstico do bug

Os dados são salvos corretamente no banco (confirmado pelo print da tabela `profiles`), mas somem da UI após o refresh. Há **duas causas** combinadas:

### Causa 1 — Race condition de autenticação (causa principal)
Em `useAuth.ts`, `supabase.auth.getSession()` é assíncrono. Os componentes que disparam `useQuery` montam imediatamente, e como o guard usa apenas `enabled: !!user?.id`, o React Query pode disparar a query no instante exato em que o cliente Supabase ainda **não anexou o JWT**. Resultado: `auth.uid()` retorna `null` no servidor, a RLS de `profiles` (`id = auth.uid()`) bloqueia, e `.maybeSingle()` devolve `null` **sem erro**. A UI então renderiza "vazio" como se o registro não existisse.

A workspace às vezes "aparece" porque sua query roda um tick depois (já com o token), mas o profile sempre perde a corrida porque é consumido pela Sidebar logo no primeiro render.

### Causa 2 — Colisão de cache key entre Sidebar e Settings
- `useOwnerBranding` (Sidebar): `queryKey: ["profile", userId]` selecionando `custom_logo_url, full_name`.
- `Settings.ProfileCard`: `queryKey: ["profile", userId]` selecionando `full_name, email, custom_logo_url`.

Compartilham a mesma chave mas retornam **shapes diferentes**. Quem montar primeiro popula o cache; o segundo recebe um objeto sem o campo que precisa (ex.: `email` undefined no formulário de Configurações).

### Causa 3 (menor) — Cache-buster persistido
O `?v=${Date.now()}` está sendo gravado dentro de `custom_logo_url` no banco. Isso polui o valor canônico, complica deduplicação e faz com que o cache-buster nunca mude após salvo (perdendo o propósito). Deve ser aplicado **na renderização**, não na persistência.

---

## Plano de correção

### 1. Hook `useAuthReady` (novo)
Criar `src/hooks/useAuthReady.ts` seguindo o padrão recomendado: combina `getSession()` + `onAuthStateChange()` e expõe `{ user, session, isReady }`. `isReady = true` somente após o `getSession()` inicial resolver, garantindo que o JWT já está no cliente Supabase antes de qualquer fetch.

`useAuth` continua existindo para `signIn/signUp/signOut`, mas todos os `useQuery` que dependem de RLS passam a usar `useAuthReady` e `enabled: isReady && !!user?.id`.

### 2. Separar query keys e adicionar `enabled: isReady`
- `useOwnerBranding` → `queryKey: ["owner-branding", userId]`, `enabled: isReady && !!userId`.
- `Settings.ProfileCard` → `queryKey: ["profile-settings", userId]`, `enabled: isReady && !!userId`.
- `Settings.MercadoPagoCard` → `enabled: isReady && !!userId`.
- Mutations invalidam **ambas** as keys (`owner-branding` e `profile-settings`) para manter Sidebar e Form sincronizados.

### 3. Remover cache-buster do banco
- Storage upload continua igual (`upsert: true`).
- `custom_logo_url` armazena apenas a URL pública limpa (`pub.publicUrl`).
- O `?v=timestamp` é aplicado **na hora de renderizar** (Sidebar, preview no Settings, Logo público no checkout), usando o `created_at`/`updated_at` do profile **ou** simplesmente um timestamp armazenado em memória após mutation. Solução simples: derivar o cache-buster a partir do hash da URL ou usar o próprio `Date.now()` apenas em retorno otimista da mutation, sem persistir.

### 4. Guard global no `AuthenticatedLayout`
`AuthenticatedLayout` passa a usar `useAuthReady` e bloqueia o render dos filhos enquanto `!isReady`. Isso garante que Sidebar, Settings e qualquer página filha só montem com o token já anexado — eliminando a race em qualquer rota futura.

### 5. Máscara e validação do WhatsApp em `NewVaultDialog`
- Adicionar utilitário `formatBRPhone(value)` em `src/lib/phone.ts` que aceita dígitos e formata progressivamente para `(XX) XXXXX-XXXX` ou `(XX) XXXX-XXXX`.
- No campo `client_whatsapp`:
  - `onChange` aplica a máscara.
  - `inputMode="tel"` + `maxLength={16}`.
  - Validação Zod: opcional, mas se preenchido exige 10 ou 11 dígitos numéricos. Mensagem clara em português.
- Persistir no banco apenas dígitos (`+55` opcional + DDD + número), normalizados — manter compatível com `wa.me` no template de e-mail.
- Feedback visual: borda/texto de erro via `FormMessage` já existente; mostrar contador discreto de dígitos quando inválido.

---

## Arquivos afetados

**Criar**
- `src/hooks/useAuthReady.ts`
- `src/lib/phone.ts`

**Editar**
- `src/hooks/useBranding.ts` — nova query key, usar `useAuthReady`.
- `src/pages/Settings.tsx` — nova query key, `useAuthReady`, parar de persistir `?v=`, invalidar ambas as keys.
- `src/layouts/AuthenticatedLayout.tsx` — usar `useAuthReady`.
- `src/components/AppSidebar.tsx` — usar `useAuthReady` (em vez de `useAuth`) onde fizer sentido.
- `src/components/NewVaultDialog.tsx` — máscara + validação do WhatsApp.
- `src/components/Logo.tsx` (opcional) — aceitar `cacheBust?: string | number` e concatenar `?v=` no src ao renderizar.
- `docs/TECH_SPEC.md` — registrar o padrão `useAuthReady` e a regra "nunca persistir cache-buster".

Sem alterações de banco, RLS, Edge Functions ou Storage policies.

---

## Critérios de aceite

1. Após refresh em `/configuracoes`, logo, nome, email e token aparecem corretamente, sem flicker de "vazio".
2. Sidebar mostra logo customizada e nome imediatamente após salvar e após refresh.
3. `custom_logo_url` no banco fica limpo, sem `?v=` acumulado.
4. Campo WhatsApp em "Novo Cofre" formata enquanto digita e valida 10/11 dígitos.
