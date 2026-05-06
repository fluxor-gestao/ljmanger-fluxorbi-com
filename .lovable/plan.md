# Migração de dados + ajustes finais de auth

Você anexou o `migration_bundle.sql` gerado no projeto antigo. Ele contém INSERTs com `ON CONFLICT (id) DO NOTHING` para `auth.users`, `auth.identities`, e tabelas `public.*`, com hashes bcrypt de senha preservados — ou seja, sua senha original do `juliocezarvieira21@gmail.com` continuará funcionando após a importação.

## O que vou fazer

### 1. Importar o bundle no banco novo
Executar o SQL inteiro do `migration_bundle.sql` via migration:
- Ativa `session_replication_role = 'replica'` para evitar que o trigger `handle_new_user` duplique profiles.
- Importa 2 usuários (incluindo você como admin), 2 identities, 2 profiles, 2 user_roles (admin), 3 clients, 3 devis, 3 services, 5 financial_entries, 6 import_batches, 6 audit_logs.
- UUIDs originais preservados — todos os relacionamentos continuam válidos.
- Idempotente: se algo já existir, é ignorado.

Após import, valido com SELECTs de contagem em cada tabela para confirmar.

### 2. Remover aba "Cadastrar" da tela `/auth`
Em `src/routes/auth.tsx`, deixar apenas o formulário de login. Novos usuários só serão criados pelo admin via `/admin` (que já usa a edge function `manage-users`).

### 3. Confirmar acesso admin
Você loga com `juliocezarvieira21@gmail.com` + sua senha original (a do projeto antigo). O role `admin` já vem no bundle.

## Detalhes técnicos

- O schema do banco novo já tem todas as tabelas, enums (`app_role`, `devis_status`, `conciliation_status`, etc.), funções e RLS necessários — então o bundle deve aplicar sem erro de coluna/enum faltando.
- Os triggers `handle_new_user` e `generate_devis_number` ficam desativados durante o INSERT (graças ao `session_replication_role`) e voltam ao normal no `COMMIT`.
- Não vou tocar em `src/integrations/supabase/client.ts` nem `types.ts` (auto-gerados).
- Após login, caso o `userRole` não apareça imediatamente, basta refresh — o `AuthContext` já busca de `user_roles`.

## Risco / rollback

Se algum INSERT falhar (ex: enum value não existe), o `BEGIN/COMMIT` faz rollback total — banco fica intocado e o erro do psql aponta exatamente o que faltou. Nesse caso eu ajusto e re-rodo.
