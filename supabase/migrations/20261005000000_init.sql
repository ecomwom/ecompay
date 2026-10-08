-- Ecompay initial schema.
-- All access happens server-side with the service role key. RLS is enabled on every
-- table with NO policies, so the anon/authenticated roles cannot read or write anything.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Products ------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 64),
  name text not null check (char_length(name) between 1 and 120),
  description text not null check (char_length(description) between 24 and 2000),
  price_cents bigint not null check (price_cents >= 1000000),
  currency text not null default 'COP' check (currency = 'COP'),
  image_url text,
  payment_type text not null default 'PRODUCT' check (payment_type in ('PRODUCT', 'SERVICE')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Confío requires mediaAssets when paymentType is PRODUCT.
  constraint products_image_required_for_product
    check (payment_type <> 'PRODUCT' or image_url is not null)
);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

-- Product questions -----------------------------------------------------------
create table public.product_questions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  label text not null check (char_length(label) between 1 and 200),
  type text not null check (type in ('text', 'textarea', 'select', 'number')),
  required boolean not null default false,
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_questions_select_has_options
    check (type <> 'select' or jsonb_array_length(options) > 0)
);

create index product_questions_product_id_position_idx
  on public.product_questions (product_id, position);

create trigger product_questions_set_updated_at
  before update on public.product_questions
  for each row execute function public.set_updated_at();

-- Orders ----------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete restrict,
  buyer_first_name text not null check (char_length(buyer_first_name) between 1 and 80),
  buyer_phone text not null check (buyer_phone ~ '^\+[1-9][0-9]{7,14}$'),
  -- Snapshot of answers: [{ "questionId", "label", "value" }]
  answers jsonb not null default '[]'::jsonb check (jsonb_typeof(answers) = 'array'),
  amount_cents bigint not null check (amount_cents >= 1000000),
  currency text not null default 'COP' check (currency = 'COP'),
  confio_payment_id text unique,
  confio_status text,
  checkout_url text,
  status text not null default 'PENDING'
    check (status in ('PENDING', 'PAID', 'UNDER_REVIEW', 'DISPUTED', 'REFUNDED', 'EXPIRED', 'CANCELED', 'FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index orders_product_id_created_at_idx on public.orders (product_id, created_at desc);

create trigger orders_set_updated_at
  before update on public.orders
  for each row execute function public.set_updated_at();

-- Atomically replace the full question set of a product ----------------------
create or replace function public.replace_product_questions(p_product_id uuid, p_questions jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_questions) <> 'array' then
    raise exception 'p_questions must be a JSON array';
  end if;

  delete from public.product_questions where product_id = p_product_id;

  insert into public.product_questions (product_id, label, type, required, options, position)
  select
    p_product_id,
    q ->> 'label',
    q ->> 'type',
    coalesce((q ->> 'required')::boolean, false),
    coalesce(q -> 'options', '[]'::jsonb),
    (ord - 1)::integer
  from jsonb_array_elements(p_questions) with ordinality as t(q, ord);
end;
$$;

revoke all on function public.replace_product_questions(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.replace_product_questions(uuid, jsonb) to service_role;

-- Row Level Security: enabled, no policies (service role bypasses RLS) -------
alter table public.products enable row level security;
alter table public.product_questions enable row level security;
alter table public.orders enable row level security;

revoke all on table public.products, public.product_questions, public.orders from anon, authenticated;
