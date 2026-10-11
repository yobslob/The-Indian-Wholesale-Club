-- =============================================================================
-- Home & gifts (D-106): a third product type beside clothing and spices. Alone in its migration because a new enum
-- value cannot be used in the transaction that adds it.
-- =============================================================================
alter type public.product_type add value if not exists 'home';
