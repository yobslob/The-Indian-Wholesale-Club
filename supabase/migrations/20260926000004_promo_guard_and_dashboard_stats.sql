-- =============================================================
-- Migration: promo redemption guard + admin dashboard aggregates
-- (BUGS.md H5, M3, C9)
-- =============================================================

-- 1. Promo increment now enforces max_uses / validity atomically and
--    reports whether the increment actually happened (H5).
CREATE OR REPLACE FUNCTION increment_promo_uses(promo_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    updated_rows INT;
BEGIN
    UPDATE promo_codes
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE id = promo_id
      AND is_active = TRUE
      AND (max_uses IS NULL OR current_uses < max_uses)
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until >= NOW());

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN updated_rows = 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION increment_promo_uses(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION increment_promo_uses(UUID) TO service_role;

-- 2. Dashboard statistics computed in SQL instead of loading every order
--    row into JavaScript (M3 / C9).
CREATE OR REPLACE FUNCTION admin_dashboard_stats()
RETURNS JSONB AS $$
    WITH paid AS (
        SELECT total_cents, created_at
        FROM orders
        WHERE payment_status = 'paid'
    ),
    totals AS (
        SELECT
            COALESCE(SUM(total_cents), 0)::bigint AS revenue_cents,
            COUNT(*)::int AS order_count,
            COALESCE(SUM(total_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::bigint AS rev_7d,
            COALESCE(SUM(total_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days'), 0)::bigint AS rev_prev,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int AS orders_7d,
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days' AND created_at < NOW() - INTERVAL '7 days')::int AS orders_prev
        FROM paid
    ),
    ops AS (
        SELECT
            (SELECT COUNT(*) FROM orders WHERE status IN ('confirmed', 'processing'))::int AS pending_shipments,
            (SELECT COUNT(*) FROM product_variants WHERE is_active = TRUE AND inventory_count <= low_stock_threshold)::int AS low_stock_count
    ),
    trend AS (
        SELECT
            to_char(d, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(p.total_cents), 0)::bigint AS revenue_cents,
            COUNT(p.created_at)::int AS order_count
        FROM generate_series((NOW() - INTERVAL '6 days')::date, NOW()::date, INTERVAL '1 day') AS d
        LEFT JOIN paid p ON p.created_at::date = d::date
        GROUP BY d
        ORDER BY d
    )
    SELECT jsonb_build_object(
        'total_revenue_cents', t.revenue_cents,
        'total_orders', t.order_count,
        'average_order_value_cents', CASE WHEN t.order_count > 0 THEN (t.revenue_cents / t.order_count)::int ELSE 0 END,
        'pending_shipments', o.pending_shipments,
        'low_stock_count', o.low_stock_count,
        'revenue_change_pct', CASE WHEN t.rev_prev > 0 THEN round(((t.rev_7d - t.rev_prev)::numeric * 100 / t.rev_prev), 1) ELSE 0 END,
        'orders_change_pct', CASE WHEN t.orders_prev > 0 THEN round(((t.orders_7d - t.orders_prev)::numeric * 100 / t.orders_prev), 1) ELSE 0 END,
        'sales_trend', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'date', date,
                'revenue_cents', revenue_cents,
                'order_count', order_count
            ) ORDER BY date)
            FROM trend
        ), '[]'::jsonb)
    )
    FROM totals t, ops o;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION admin_dashboard_stats() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION admin_dashboard_stats() TO service_role;
