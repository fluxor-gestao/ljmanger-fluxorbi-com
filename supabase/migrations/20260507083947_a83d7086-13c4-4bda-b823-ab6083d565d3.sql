
CREATE OR REPLACE FUNCTION public.bi_kpis_comercial(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT status, total_amount, accepted_at, rejected_at
    FROM public.devis
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to IS NULL OR created_at <= (_to::timestamp + interval '1 day'))
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS total_devis,
      COUNT(*) FILTER (WHERE accepted_at IS NOT NULL)::bigint AS accepted,
      COUNT(*) FILTER (WHERE rejected_at IS NOT NULL)::bigint AS rejected,
      COALESCE(SUM(total_amount), 0)::numeric AS total_amount,
      COALESCE(SUM(total_amount) FILTER (WHERE accepted_at IS NOT NULL), 0)::numeric AS accepted_amount
    FROM base
  ),
  by_status AS (
    SELECT jsonb_object_agg(status, c) AS by_status
    FROM (SELECT status, COUNT(*)::bigint AS c FROM base GROUP BY status) s
  )
  SELECT jsonb_build_object(
    'total_devis', agg.total_devis,
    'accepted', agg.accepted,
    'rejected', agg.rejected,
    'conversion_rate', CASE WHEN agg.total_devis > 0 THEN agg.accepted::numeric / agg.total_devis ELSE 0 END,
    'total_amount', agg.total_amount,
    'accepted_amount', agg.accepted_amount,
    'avg_ticket', CASE WHEN agg.total_devis > 0 THEN agg.total_amount / agg.total_devis ELSE 0 END,
    'by_status', COALESCE(by_status.by_status, '{}'::jsonb)
  )
  FROM agg, by_status;
$$;

CREATE OR REPLACE FUNCTION public.bi_kpis_financeiro(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT entry_date, amount_in, amount_out
    FROM public.financial_entries
    WHERE (_from IS NULL OR entry_date >= _from)
      AND (_to IS NULL OR entry_date <= _to)
  ),
  totals AS (
    SELECT
      COALESCE(SUM(amount_in), 0)::numeric AS total_in,
      COALESCE(SUM(amount_out), 0)::numeric AS total_out,
      COUNT(*)::bigint AS entries_count
    FROM base
  ),
  by_month AS (
    SELECT jsonb_object_agg(month, payload) AS by_month
    FROM (
      SELECT
        to_char(entry_date, 'YYYY-MM') AS month,
        jsonb_build_object(
          'in', COALESCE(SUM(amount_in), 0),
          'out', COALESCE(SUM(amount_out), 0),
          'net', COALESCE(SUM(amount_in), 0) - COALESCE(SUM(amount_out), 0)
        ) AS payload
      FROM base
      WHERE entry_date IS NOT NULL
      GROUP BY 1
    ) m
  )
  SELECT jsonb_build_object(
    'total_in', totals.total_in,
    'total_out', totals.total_out,
    'net', totals.total_in - totals.total_out,
    'entries_count', totals.entries_count,
    'by_month', COALESCE(by_month.by_month, '{}'::jsonb)
  )
  FROM totals, by_month;
$$;

CREATE OR REPLACE FUNCTION public.bi_kpis_operacao(_from date DEFAULT NULL, _to date DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT status, expected_end_date, actual_end_date
    FROM public.services
    WHERE (_from IS NULL OR created_at >= _from)
      AND (_to IS NULL OR created_at <= (_to::timestamp + interval '1 day'))
  ),
  agg AS (
    SELECT
      COUNT(*)::bigint AS total_services,
      COUNT(*) FILTER (WHERE actual_end_date IS NOT NULL)::bigint AS completed,
      COUNT(*) FILTER (WHERE expected_end_date IS NOT NULL AND actual_end_date IS NULL AND expected_end_date < CURRENT_DATE)::bigint AS delayed
    FROM base
  ),
  by_status AS (
    SELECT jsonb_object_agg(status, c) AS by_status
    FROM (SELECT status, COUNT(*)::bigint AS c FROM base GROUP BY status) s
  )
  SELECT jsonb_build_object(
    'total_services', agg.total_services,
    'completed', agg.completed,
    'delayed', agg.delayed,
    'in_progress', agg.total_services - agg.completed,
    'by_status', COALESCE(by_status.by_status, '{}'::jsonb)
  )
  FROM agg, by_status;
$$;

REVOKE ALL ON FUNCTION public.bi_kpis_comercial(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bi_kpis_financeiro(date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bi_kpis_operacao(date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bi_kpis_comercial(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.bi_kpis_financeiro(date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.bi_kpis_operacao(date, date) TO service_role;
