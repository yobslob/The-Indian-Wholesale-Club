-- =============================================================
-- Migration: stronger order numbers (BUGS.md C2)
-- 4 hex chars (16 bits) was enumerable; use 10 hex chars (40 bits)
-- from gen_random_uuid() so order numbers cannot be brute-forced.
-- =============================================================

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.order_number IS NULL THEN
        NEW.order_number := 'ORD-' || to_char(NOW(), 'YYYYMMDD') || '-'
            || upper(substring(replace(gen_random_uuid()::text, '-', '') from 1 for 10));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION generate_order_number() IS
    'BEFORE INSERT trigger: ORD-YYYYMMDD-<10 hex chars> (40 bits of randomness).';
