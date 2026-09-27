-- =============================================================================
-- Migration: 20260925000005_fix_triggers_and_constraints.sql
-- Description:
--   1. Replace non-firing orders trigger with order_items stock deduction trigger
--   2. Implement auto-restock trigger when order status changes to cancelled/refunded
--   3. Add unique index on orders(payment_intent_id) to eliminate duplicate order risk
--   4. Add atomic increment_promo_uses RPC function
--   5. Fix FREESHIP promo code discount value to prevent double-discounting
-- =============================================================================

-- 1. Drop the legacy non-firing trigger on orders
DROP TRIGGER IF EXISTS trigger_deduct_inventory ON orders;
DROP FUNCTION IF EXISTS deduct_inventory_on_order();

-- 2. Create trigger on order_items to deduct variant inventory count atomically
CREATE OR REPLACE FUNCTION deduct_stock_on_order_item()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE product_variants
    SET inventory_count = GREATEST(0, inventory_count - NEW.quantity),
        updated_at = NOW()
    WHERE id = NEW.variant_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_deduct_stock_on_item_insert ON order_items;
CREATE TRIGGER trigger_deduct_stock_on_item_insert
    AFTER INSERT ON order_items
    FOR EACH ROW
    EXECUTE FUNCTION deduct_stock_on_order_item();

-- 3. Create trigger on orders to handle inventory restoration/re-deduction on status transitions
CREATE OR REPLACE FUNCTION handle_order_status_inventory_change()
RETURNS TRIGGER AS $$
DECLARE
    item RECORD;
BEGIN
    -- If order transitions into cancelled or refunded, restore stock back to variants
    IF NEW.status IN ('cancelled', 'refunded') AND OLD.status NOT IN ('cancelled', 'refunded') THEN
        FOR item IN SELECT variant_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            UPDATE product_variants
            SET inventory_count = inventory_count + item.quantity,
                updated_at = NOW()
            WHERE id = item.variant_id;
        END LOOP;
    -- If an order was previously cancelled/refunded and re-opened, re-deduct
    ELSIF OLD.status IN ('cancelled', 'refunded') AND NEW.status NOT IN ('cancelled', 'refunded') THEN
        FOR item IN SELECT variant_id, quantity FROM order_items WHERE order_id = NEW.id LOOP
            UPDATE product_variants
            SET inventory_count = GREATEST(0, inventory_count - item.quantity),
                updated_at = NOW()
            WHERE id = item.variant_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_order_status_inventory_change ON orders;
CREATE TRIGGER trigger_order_status_inventory_change
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_order_status_inventory_change();

-- 4. Unique index on orders(payment_intent_id) to prevent duplicate payment intent orders (N13)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_payment_intent_id
    ON orders(payment_intent_id)
    WHERE payment_intent_id IS NOT NULL;

-- 5. Atomic promo code use increment function (H5)
CREATE OR REPLACE FUNCTION increment_promo_uses(promo_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE promo_codes
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE id = promo_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Fix FREESHIP promo code in promo_codes table (N11)
-- FREESHIP provides free shipping; item subtotal discount value should be 0
UPDATE promo_codes
SET discount_value = 0
WHERE code = 'FREESHIP' AND discount_type = 'fixed';
