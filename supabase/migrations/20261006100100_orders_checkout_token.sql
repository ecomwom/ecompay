-- One-time token rendered into each checkout form. A repeated submit with the same
-- token reuses the existing order instead of creating a second order and payment.
alter table public.orders add column checkout_token uuid unique;
