# Corrigir card Comercial da Central de Ajuda

## Causa
No roteamento por arquivos do TanStack Router, `src/routes/_authenticated/ajuda.tsx` é tratado como **layout pai** das rotas `ajuda.*.tsx` (filhos). Como esse arquivo renderiza o conteúdo do índice direto, sem `<Outlet />`, quando o usuário clica no card e navega para `/ajuda/comercial` a rota filha casa mas não tem onde renderizar — o clique parece "não funcionar".

## Solução (mínima e segura)
Usar a convenção `_` (underscore final) para **optar por sair do aninhamento de layout**, mantendo cada página independente.

1. Renomear `src/routes/_authenticated/ajuda.comercial.tsx` → `src/routes/_authenticated/ajuda_.comercial.tsx`.
2. Atualizar a declaração interna do arquivo:
   - `createFileRoute("/_authenticated/ajuda/comercial")` → `createFileRoute("/_authenticated/ajuda_/comercial")`
   - A URL pública continua sendo `/ajuda/comercial` (o `_` é só convenção de arquivo, não aparece na URL).
3. Ajustar o `<Link to="/ajuda/comercial">` no `ModuleCard` (em `ajuda.tsx`) — o `to` continua `/ajuda/comercial`, sem mudança visível, mas validar que o type-check do TanStack aceita após o regen do `routeTree.gen.ts`.
4. Conferir o link "Voltar à Central de Ajuda" dentro de `ajuda_.comercial.tsx` (`to="/ajuda"`) — segue funcionando normalmente.

Não há mudanças visuais, nem em outros módulos. Nenhum componente compartilhado é alterado.

## Verificação
- Recarregar `/ajuda` → clicar no card Comercial → tela de ajuda do Comercial deve carregar.
- Botão "Voltar" deve retornar para `/ajuda`.
- Acesso direto via URL `/ajuda/comercial` deve funcionar.

## Alternativa considerada
Renomear `ajuda.tsx` → `ajuda.index.tsx` (transformaria `ajuda.tsx` no índice sob o layout). Funciona, mas exigiria criar um arquivo de layout `ajuda.tsx` com `<Outlet />` para os filhos — mais arquivos sem benefício, já que as páginas de ajuda não compartilham layout específico.
