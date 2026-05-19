# Correção do idioma da proposta + botão de tradução na visualização

## Problema observado

Na imagem, a proposta gerada pela IA mistura **francês** (scope items: "Préparation d'une proposition…", "Inclusion d'une analyse…", "Julien Pluot s'est montré très intéressé…") com **português** (resumo da reunião, descrição do escopo, estrutura A/B/C/...). Isso ocorre porque:

- `analyze-meeting-report/index.ts` (linha 18) instrui: *"Responda sempre em pt-BR nos campos textuais finais."*
- Mas o modelo recebe a ata em francês e acaba copiando trechos literais (especialmente em `scope_items.description` e dentro de `proposal_structure`), gerando saída híbrida.

Resultado: a proposta nasce sem um idioma "nativo" coerente.

---

## Parte 1 — Corrigir geração (idioma único e consistente)

### 1.1 Persistir o idioma da proposta
Adicionar coluna `source_language` em `devis` (`text`, default `'pt'`, valores: `pt|fr|en|es`) via migration. Esse será o **idioma nativo** da proposta, definido no momento da geração e nunca alterado depois.

### 1.2 Ajustar `analyze-meeting-report`
- Trocar a instrução fixa "responda sempre em pt-BR" por: **"Gere TODOS os campos textuais (client.notes, meeting.summary/report, devis.title, devis.scope_description, devis.proposal_structure, devis.scope_items[].title/description) no MESMO idioma detectado em `detected_language`. Não misture idiomas. Não copie trechos literais da ata em outro idioma — reescreva tudo no idioma final escolhido."**
- Reforçar no system prompt: *"A consistência de idioma é obrigatória. Se detectar francês, TODO texto em francês; se português, TODO em português."*
- Manter `detected_language` no schema (já existe).

### 1.3 Ajustar `generate-devis-proposal` (regeneração manual)
- Aceitar parâmetro `language` (pt|fr|en|es) e gerar 100% no idioma pedido.
- Atualizar o system prompt: remover "português do Brasil" fixo; usar o idioma recebido.

### 1.4 Salvar o idioma ao criar o devis
No fluxo `UploadAtaDialog` (onde a ata é processada e o devis é criado), gravar `source_language = payload.detected_language` ao inserir o registro.

---

## Parte 2 — Botão "Traduzir para português" na visualização

### 2.1 UI
Na página `src/routes/_authenticated/comercial_.devis.$id.tsx`, no topo (header com botões de ação), adicionar botão:

- **Quando `devis.source_language !== 'pt'`** → mostrar botão `🌐 Traduzir para Português`.
- **Quando ativo** → o botão vira `↩ Ver no idioma original (FR/EN/ES)`.
- Estado local `viewLanguage: 'native' | 'pt'`, **não persiste** no banco — só afeta visualização.

### 2.2 Tradução
Criar server function `translate-devis-view` (`src/lib/devis-translate.functions.ts`) usando `createServerFn` + Lovable AI Gateway (`google/gemini-2.5-flash`):

- Input: campos textuais do devis + `target_language: 'pt'`.
- Output: mesmos campos traduzidos, mantendo a estrutura (A/B/C…, itens 1/2/3, valores em R$, números, datas intactos).
- Cache em memória por id+lang para evitar re-chamada ao alternar.
- Loading state no botão (`Loader2`).

### 2.3 Render
Quando `viewLanguage === 'pt'`, substituir nos campos exibidos (Tipo de serviço, Setor responsável, Descrição do escopo, Estrutura da proposta, Resumo da reunião, scope_items) pelos textos traduzidos. **Nada é gravado no banco.** O PDF e o envio por email continuam usando o idioma nativo.

### 2.4 Indicador visual
Quando em modo traduzido, mostrar um badge discreto no topo: `"Visualização traduzida — idioma nativo: Francês"`.

---

## Arquivos afetados

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/*_devis_source_language.sql` | Nova coluna `devis.source_language` |
| `supabase/functions/analyze-meeting-report/index.ts` | Prompt: idioma único consistente |
| `supabase/functions/generate-devis-proposal/index.ts` | Aceitar `language`, gerar no idioma pedido |
| `src/components/devis/UploadAtaDialog.tsx` | Gravar `source_language` na criação |
| `src/lib/devis-translate.functions.ts` | **NOVO** — server function de tradução |
| `src/routes/_authenticated/comercial_.devis.$id.tsx` | Botão de tradução + render condicional |

## Detalhes técnicos

- A tradução server-side usa Lovable AI Gateway (sem custo extra ao usuário, já configurado).
- Backfill: devis antigos sem `source_language` assumem `'pt'` (default).
- O PDF (`DevisPdfTemplate`) e o envio por email **NÃO** são afetados — sempre usam idioma nativo. Isso preserva a integridade legal da proposta.
- A tradução é puramente cosmética/visual no painel interno.
