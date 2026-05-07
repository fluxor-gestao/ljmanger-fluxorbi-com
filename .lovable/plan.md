## Mudanças

### 1. Tela de Login (`src/routes/auth.tsx`)
Ajustar para ficar igual à imagem de referência:
- Trocar o subtítulo "Acesse sua conta" por **"Faça login"** (em azul, estilo link).
- Manter o card centralizado, com logo, título "Lundgaard Hub", campos Email/Senha e botão azul "Entrar".
- Remover o texto "Acesso restrito. Novos usuários são criados pelo administrador." (não aparece na referência).
- Garantir fundo cinza claro (`bg-muted/30`) como na imagem.

### 2. Tela de Transição (`src/components/LoadingScreen.tsx`)
- Trocar a mensagem padrão para **"Abrindo sistema..."**.
- Já está com logo + indicador azul pulsante — bate com a referência.

### 3. Mostrar a tela de transição em TODA navegação
Hoje a `LoadingScreen` só aparece enquanto o auth carrega. Vamos exibi-la também:

**a) Logo após o login** — em `src/routes/auth.tsx`, ao concluir `signInWithPassword` com sucesso, mostrar a `LoadingScreen` antes de navegar para `/hub` (estado local `redirecting`).

**b) Em qualquer clique de navegação dentro do sistema** — em `src/components/AppLayout.tsx`, usar `useRouterState({ select: s => s.isLoading || s.isTransitioning })` do TanStack Router para detectar navegações em andamento e renderizar um overlay com a `LoadingScreen` por cima do conteúdo enquanto a próxima rota carrega (loaders, code-splitting, etc.).

```tsx
const isNavigating = useRouterState({
  select: (s) => s.isLoading || s.isTransitioning,
});
// ...
{isNavigating && (
  <div className="fixed inset-0 z-50 bg-background">
    <LoadingScreen message="Abrindo sistema..." />
  </div>
)}
```

Isso reproduz o comportamento do sistema antigo: ao clicar em qualquer módulo (Comercial, Financeiro, Devis, etc.), a tela de transição aparece até a próxima rota terminar de carregar.

### Arquivos alterados
- `src/routes/auth.tsx` — visual + redirect com loading.
- `src/components/LoadingScreen.tsx` — mensagem padrão "Abrindo sistema...".
- `src/components/AppLayout.tsx` — overlay de transição em navegações.

Sem mudanças de schema, sem novas dependências.