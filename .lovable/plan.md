## Objetivo

Tornar o PixelSafe instalável como app standalone no Android (e melhorar a experiência no iOS) adicionando um `manifest.json` mínimo, sem service worker. Isso evita os problemas de cache do PWA completo no preview do Lovable e mantém o desenvolvimento fluido.

## O que será feito

### 1. Gerar ícone 192×192
- Derivar `public/icon-192.png` a partir do `public/favicon.png` atual (512×512) usando ImageMagick no sandbox.
- Manter `public/favicon.png` (512×512) como o ícone "any/maskable" grande.
- **Não** será necessário você enviar nenhuma imagem nova.

### 2. Criar `public/manifest.json`
Conteúdo:
```json
{
  "name": "PixelSafe — Cofre digital",
  "short_name": "PixelSafe",
  "description": "Proteja entregas e pagamentos dos seus projetos freelancer.",
  "start_url": "/dashboard",
  "scope": "/",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#0A0A0A",
  "theme_color": "#0A0A0A",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any maskable" },
    { "src": "/favicon.png",  "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

Observações:
- `start_url: /dashboard` faz o app abrir direto na área logada (se não autenticado, sua rota já redireciona para `/login`).
- `theme_color`/`background_color` em preto para casar com o tema dark da app.
- `purpose: "any maskable"` cobre tanto launchers normais quanto Android com ícones adaptativos.

### 3. Atualizar `index.html`
Adicionar dentro do `<head>`:
```html
<link rel="manifest" href="/manifest.json">
<meta name="theme-color" content="#0A0A0A">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="PixelSafe">
```
O `<link rel="icon">` e `<link rel="apple-touch-icon">` atuais permanecem.

### 4. O que NÃO será feito (intencional)
- **Sem service worker** / sem `vite-plugin-pwa`. Motivo: causa cache antigo no preview do Lovable e no editor, atrapalhando desenvolvimento. Funcionalidade offline não é requisito do PixelSafe.
- Sem ícones extras (16, 32, 48, 72…). O favicon.png escala bem em todos os contextos modernos; manter o set mínimo evita ruído.
- Sem alterar `src/pages/Install.tsx` — as instruções atuais continuam válidas.

### 5. Documentação
Adicionar uma nota curta em `docs/TECH_SPEC.md` na seção de PWA/Mobile registrando que o app é "manifest-only installable" (sem SW) e o motivo.

## Resultado esperado

- **Android (Chrome)**: passa a aparecer prompt nativo "Instalar app"; uma vez instalado, abre em standalone (sem barra de URL), com ícone do escudo e tema preto.
- **iPhone (Safari)**: continua funcionando via "Adicionar à Tela de Início" com o `apple-touch-icon` já configurado; agora também respeita título "PixelSafe" e status bar escura.
- **Preview Lovable**: nenhum impacto — sem SW, sem cache persistente.

## Arquivos afetados

- `public/icon-192.png` (novo, gerado do 512)
- `public/manifest.json` (novo)
- `index.html` (adições no `<head>`)
- `docs/TECH_SPEC.md` (nota curta)
