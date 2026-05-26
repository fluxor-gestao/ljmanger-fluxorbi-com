
-- RPCs para Financeiro: summary (cards) e analítico (por competência)
-- Respeitam os MESMOS filtros aplicados na lista paginada.

CREATE OR REPLACE FUNCTION public.financeiro_summary(
  _competence text DEFAULT NULL,
  _business text DEFAULT NULL,
  _search text DEFAULT NULL,
  _bank uuid DEFAULT NULL,
  _type text DEFAULT NULL,
  _status text DEFAULT NULL,
  _origin text DEFAULT NULL,
  _realized text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM public.financial_entries fe
    WHERE (_competence IS NULL OR fe.competence_month = _competence)
      AND (_business IS NULL OR fe.business_unit = _business)
      AND (_bank IS NULL OR fe.bank_account_id = _bank)
      AND (_type IS NULL OR fe.entry_type::text = _type)
      AND (_status IS NULL OR fe.conciliation_status::text = _status)
      AND (
        _search IS NULL
        OR fe.movement_description ILIKE '%' || _search || '%'
        OR fe.counterparty_name ILIKE '%' || _search || '%'
      )
      AND (
        _origin IS NULL
        OR (_origin = 'transferência' AND fe.entry_type::text = 'transferencia')
        OR (_origin = 'ofx' AND fe.source_type::text IN ('ofx','extrato'))
        OR (_origin = 'comercial' AND fe.document_reference IS NOT NULL AND fe.entry_type::text <> 'transferencia')
        OR (_origin = 'manual' AND fe.source_type::text = 'manual' AND fe.document_reference IS NULL)
      )
      AND (
        _realized IS NULL
        OR (_realized = 'previsto' AND fe.conciliation_status::text = 'pendente')
        OR (_realized = 'realizado' AND fe.conciliation_status::text <> 'pendente')
      )
  ),
  realized AS (
    SELECT
      COALESCE(SUM(amount_in), 0)::numeric AS total_in,
      COALESCE(SUM(amount_out), 0)::numeric AS total_out
    FROM base
    WHERE conciliation_status::text <> 'pendente'
      AND COALESCE(entry_type::text, '') <> 'transferencia'
  ),
  transfers AS (
    SELECT COALESCE(SUM(COALESCE(amount_in,0) + COALESCE(amount_out,0)), 0)::numeric AS transfers
    FROM base
    WHERE entry_type::text = 'transferencia'
  ),
  previsto AS (
    SELECT COALESCE(SUM(amount_in), 0)::numeric AS previsto_in
    FROM base
    WHERE conciliation_status::text = 'pendente'
      AND COALESCE(entry_type::text, '') <> 'transferencia'
  )
  SELECT jsonb_build_object(
    'saldoInicial', 0,
    'totalIn', realized.total_in,
    'totalOut', realized.total_out,
    'transfers', transfers.transfers,
    'saldoFinal', realized.total_in - realized.total_out,
    'disponivel', realized.total_in - realized.total_out,
    'previstoIn', previsto.previsto_in,
    'entries_count', (SELECT COUNT(*) FROM base)
  )
  FROM realized, transfers, previsto;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_analitico(
  _competence text DEFAULT NULL,
  _business text DEFAULT NULL,
  _search text DEFAULT NULL,
  _bank uuid DEFAULT NULL,
  _type text DEFAULT NULL,
  _status text DEFAULT NULL,
  _origin text DEFAULT NULL,
  _realized text DEFAULT NULL
)
RETURNS TABLE(competence text, total_in numeric, total_out numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT *
    FROM public.financial_entries fe
    WHERE (_competence IS NULL OR fe.competence_month = _competence)
      AND (_business IS NULL OR fe.business_unit = _business)
      AND (_bank IS NULL OR fe.bank_account_id = _bank)
      AND (_type IS NULL OR fe.entry_type::text = _type)
      AND (_status IS NULL OR fe.conciliation_status::text = _status)
      AND (
        _search IS NULL
        OR fe.movement_description ILIKE '%' || _search || '%'
        OR fe.counterparty_name ILIKE '%' || _search || '%'
      )
      AND (
        _origin IS NULL
        OR (_origin = 'transferência' AND fe.entry_type::text = 'transferencia')
        OR (_origin = 'ofx' AND fe.source_type::text IN ('ofx','extrato'))
        OR (_origin = 'comercial' AND fe.document_reference IS NOT NULL AND fe.entry_type::text <> 'transferencia')
        OR (_origin = 'manual' AND fe.source_type::text = 'manual' AND fe.document_reference IS NULL)
      )
      AND (
        _realized IS NULL
        OR (_realized = 'previsto' AND fe.conciliation_status::text = 'pendente')
        OR (_realized = 'realizado' AND fe.conciliation_status::text <> 'pendente')
      )
  )
  SELECT
    COALESCE(competence_month, '—') AS competence,
    COALESCE(SUM(amount_in), 0)::numeric AS total_in,
    COALESCE(SUM(amount_out), 0)::numeric AS total_out
  FROM base
  WHERE COALESCE(entry_type::text, '') <> 'transferencia'
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

-- Garantir permissões de execução (security definer já faz o trabalho, mas explicitamos)
GRANT EXECUTE ON FUNCTION public.financeiro_summary(text, text, text, uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.financeiro_analitico(text, text, text, uuid, text, text, text, text) TO authenticated, service_role;
