
# PixelSafe — Interface Mockada (Fase 1)

## Nota sobre o stack

Lovable é baseado em **React 18 + Vite + Tailwind + React Router**, não em TanStack Start. A entrega replica fielmente a estrutura que você descreveu (root layout, login, layout autenticado, dashboard) usando o equivalente idiomático deste stack — mesmo design, mesma UX, mesmos mocks. Nenhum backend, banco ou auth real.

---

## O que será construído

### 1. Design system (dark forçado)
- Definir tokens HSL no `src/index.css` para a paleta exata:
  - Background app: `#0A0A0A`
  - Superfície (cards): `#111111`
  - Bordas: `#1F1F1F`
  - Primária (azul elétrico): `#3B82F6`
  - Cofre/destaque (âmbar): `#F59E0B`
  - Sucesso (Pago, verde): tom verde sóbrio coerente com a paleta
- Forçar classe `dark` no `<html>` e remover qualquer toggle.
- Importar fonte **Inter** (Google Fonts) no `index.html`, aplicar como fonte base no Tailwind.
- Estética Linear: tipografia limpa, bordas sutis 1px, raio pequeno (~8px), sem sombras pesadas, hover discreto.
- Atualizar `tailwind.config.ts` para expor os tokens (`vault`, `success`, etc.) e a fontFamily Inter.

### 2. Rotas (React Router, equivalente à estrutura pedida)

| Pedido (TanStack Start)        | Implementação (React Router)                          |
|--------------------------------|--------------------------------------------------------|
| `__root.tsx`                   | `App.tsx` + `index.css` (já é o root)                  |
| `login.tsx`                    | rota `/login` → `src/pages/Login.tsx`                  |
| `_authenticated.tsx`           | `src/layouts/AuthenticatedLayout.tsx` (wrapper com `<Outlet/>`) |
| `_authenticated/dashboard.tsx` | rota `/dashboard` → `src/pages/Dashboard.tsx`          |
| `_authenticated/configuracoes` | rota `/configuracoes` → `src/pages/Settings.tsx`       |

- Rota raiz `/` redireciona para `/login`.
- "Auth" mockada: um flag em memória (`useAuth` hook com estado simples) decide se o usuário pode acessar rotas autenticadas; se não, redireciona para `/login`.

### 3. Tela de Login (`/login`)
- Tela centralizada vertical/horizontalmente, fundo `#0A0A0A`.
- Card sutil `#111111` com borda `#1F1F1F`, ~400px de largura.
- Logo: ícone de cadeado âmbar (`Lock` do lucide-react, cor `#F59E0B`) + texto "PixelSafe" em Inter semibold.
- Subtítulo discreto: "Entre na sua conta".
- Inputs de Email e Senha (shadcn `Input` + `Label`), placeholders sutis.
- Botão primário azul "Entrar" largura total.
- **Validação visual mínima**: ao clicar, se email ou senha vazios → mensagem inline em vermelho discreto sob o campo. Se ok → seta flag de auth em memória e navega para `/dashboard`.
- Link discreto "Esqueci minha senha" (sem ação).

### 4. Layout Autenticado
- Grid: sidebar fixa esquerda (~240px) + área principal flex-1.
- Sidebar (`#111111`, borda direita `#1F1F1F`):
  - Topo: logo PixelSafe (cadeado âmbar + texto).
  - Menu vertical com 2 itens usando `NavLink`:
    - **Dashboard** (ícone `LayoutDashboard`)
    - **Configurações** (ícone `Settings`)
  - Item ativo: fundo levemente mais claro + texto branco; inativo: texto cinza.
  - Rodapé: avatar/nome do usuário mockado ("Usuário Demo") + botão sair (volta para /login).
- Área principal: padding generoso, `<Outlet/>` para renderizar a rota filha.

### 5. Dashboard (`/dashboard`)
- Cabeçalho: título "Cofres" à esquerda; à direita, botão primário azul **"+ Novo Cofre"**.
- **Modal "Novo Cofre"** (shadcn `Dialog`) com campos:
  - Nome do projeto, Nome do cliente, Valor (R$), Status (select: Pendente/Pago).
  - Ao confirmar → adiciona o card à lista mockada em memória (estado React local na página). Sem persistência.
- Grid responsivo de cards (1 col mobile, 2 col md, 3 col lg).
- **3 cards mockados iniciais**:
  1. "Logo Café Raíz" — Cliente: Marina Souza — R$ 850,00 — Pendente
  2. "Edição Vídeo Casamento" — Cliente: João Pereira — R$ 2.400,00 — Pago
  3. "Identidade Visual Studio Z" — Cliente: Ana Lima — R$ 1.600,00 — Pendente
- Card design (Linear-like):
  - Fundo `#111111`, borda `#1F1F1F`, raio ~8px, padding confortável.
  - Topo: ícone cadeado âmbar pequeno + nome do projeto (semibold).
  - Linha do cliente (texto cinza pequeno).
  - Valor em destaque (texto grande, branco).
  - Badge de status no canto: "Pendente" em azul (`#3B82F6` 15% bg + texto azul) / "Pago" em verde sóbrio.
  - Hover: borda levemente clareia.

### 6. Configurações (`/configuracoes`)
- Título "Configurações" + subtítulo.
- 3 cards mockados em coluna:
  - **Perfil**: avatar + nome "Usuário Demo" + email mockado + botão secundário "Editar".
  - **Notificações**: 2 linhas com `Switch` (Email de novos pagamentos, Resumo semanal) — estado local visual.
  - **Plano**: badge "Pro" âmbar, texto "Renova em 12/05/2026", botão secundário "Gerenciar plano".
- Sem chamadas externas; tudo em memória.

---

## Detalhes técnicos

- **Arquivos novos**:
  - `src/pages/Login.tsx`
  - `src/pages/Dashboard.tsx`
  - `src/pages/Settings.tsx`
  - `src/layouts/AuthenticatedLayout.tsx`
  - `src/components/AppSidebar.tsx`
  - `src/components/VaultCard.tsx`
  - `src/components/NewVaultDialog.tsx`
  - `src/components/Logo.tsx`
  - `src/hooks/useAuth.ts` (estado simples em memória, sem localStorage)
  - `src/data/mockVaults.ts` (seed dos 3 cards)
- **Arquivos editados**:
  - `index.html` — link da fonte Inter, classe `dark` no `<html>`.
  - `src/index.css` — sobrescrita dos tokens HSL para a paleta solicitada, fonte base Inter.
  - `tailwind.config.ts` — `fontFamily.sans = ['Inter', ...]`, tokens extras `vault` (âmbar) e `success`.
  - `src/App.tsx` — novas rotas (`/login`, `/dashboard`, `/configuracoes`) + redirect raiz + guarda mockada.
- **Componentes shadcn usados** (já presentes): `button`, `input`, `label`, `dialog`, `select`, `switch`, `badge`, `card`.
- **Ícones** (lucide-react): `Lock`, `LayoutDashboard`, `Settings`, `LogOut`, `Plus`.
- Sem libs novas. Sem backend. Sem Supabase nesta fase.

## Fora de escopo (fase 1)
- Autenticação real, banco de dados, server functions.
- Persistência dos cofres criados (recarregar a página volta aos 3 mocks).
- Tema claro / toggle de tema.
- Páginas de detalhe de cofre, fluxo de pagamento, upload de arquivos.
