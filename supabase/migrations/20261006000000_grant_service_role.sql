-- Newer Supabase projects no longer grant default table privileges to API roles.
-- The app only talks to the database server-side as service_role.
grant usage on schema public to service_role;
grant select, insert, update, delete on table public.products, public.product_questions, public.orders to service_role;
