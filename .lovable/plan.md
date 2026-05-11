## Adicionar opção "Alterar senha" em Opções/Usuários

### O que será feito

1. **Backend (`supabase/functions/manage-users/index.ts`)**: adicionar nova `action: "reset-password"` que recebe `user_id` e `new_password`, valida que o caller é admin (já implementado) e chama `admin.auth.admin.updateUserById(user_id, { password })`.

2. **Frontend (`src/routes/_authenticated/admin.tsx`)**:
   - Adicionar um botão com ícone de chave (`KeyRound`) ao lado dos botões Editar/Excluir em cada linha da tabela de usuários.
   - Abrir um Dialog "Redefinir senha" pedindo a nova senha (input password, mínimo 6 caracteres) + confirmação.
   - Criar mutation `resetPassword` que invoca a edge function com `action: "reset-password"`.
   - Toast de sucesso/erro.

### Como o admin usará

Na página **Opções / Usuários** → tabela → ícone 🔑 ao lado do lápis → digita nova senha → Salvar. A senha do usuário é trocada imediatamente e ele pode logar com a nova senha.

### Observações

- Funciona para qualquer usuário (inclusive o próprio admin).
- Não envia email — é uma redefinição direta feita pelo admin.
- Usa a mesma estrutura segura já existente (service role key fica só na edge function, validação de admin via `has_role`).