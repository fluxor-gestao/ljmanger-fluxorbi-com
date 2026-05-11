## Diagnóstico

Confirmado no banco — a proposta `DE202605001` está assim:

```
status:       rascunho
validated_at: 2026-05-11 18:48
```

Ela foi validada **antes** da correção que avança o status automaticamente. Por isso continua marcada como "Rascunho" no detalhe e cai na coluna "Rascunho" do Kanban, em vez de "Pronta para envio".

Toda proposta validada **a partir de agora** já entra correta — esse é o único caso isolado de dado legado.

## Correção

Um único `UPDATE` de backfill na tabela `devis`, que ajusta apenas propostas legadas validadas e ainda não enviadas:

```sql
UPDATE public.devis
   SET status = 'pronta_para_envio'
 WHERE validated_at IS NOT NULL
   AND status IN ('rascunho', 'reuniao_realizada', 'proposta_em_geracao', 'aguardando_validacao')
   AND sent_at IS NULL
   AND accepted_at IS NULL
   AND rejected_at IS NULL;
```

Efeitos:
- A `DE202605001` (e qualquer outra na mesma situação) passa imediatamente para "Pronta para envio".
- O cartão migra sozinho para a coluna correta no Kanban (o Kanban já lê `devis.status`).
- Propostas já enviadas, aceitas ou rejeitadas não são tocadas.

## Arquivos alterados

Nenhum. Apenas um `UPDATE` único nos dados.