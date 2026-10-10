-- =============================================================================
-- Two more roles (D-102, D-103): a vendor's owner, and the photo worker's account.
-- In a migration of their own: a new enum value can't be used in the transaction that adds it.
-- =============================================================================
alter type public.app_role add value if not exists 'vendor';
alter type public.app_role add value if not exists 'worker';
