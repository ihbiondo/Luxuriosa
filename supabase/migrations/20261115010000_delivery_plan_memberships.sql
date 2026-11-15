create table if not exists public.delivery_plan_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan_code text not null check (plan_code in ('supporter', 'vip')),
  status text not null default 'active' check (status in ('active', 'paused', 'canceled', 'expired')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint delivery_plan_memberships_valid_period check (ends_at is null or ends_at > starts_at)
);

create index if not exists delivery_plan_memberships_active_lookup
  on public.delivery_plan_memberships (user_id, status, starts_at, ends_at);

alter table public.delivery_plan_memberships enable row level security;
revoke all on public.delivery_plan_memberships from anon, authenticated;
grant all on public.delivery_plan_memberships to service_role;

comment on table public.delivery_plan_memberships is
  'Assinaturas de entrega Apoiador e Privilégio VIP. Gerenciada exclusivamente pelo backend/service role.';
comment on column public.delivery_plan_memberships.plan_code is
  'supporter = Apoiador; vip = Privilégio VIP.';

-- Pedido mínimo de R$ 20,00 em Bauru e R$ 50,00 fora de Bauru.
update public.fulfillment_sla_rules
set minimum_order_up_to_12km_cents = case when city_normalized = 'bauru' then 2000 else 5000 end,
    minimum_order_up_to_35km_cents = 5000,
    minimum_order_up_to_55km_cents = 5000,
    updated_at = now()
where active = true and fulfillment_mode = 'delivery';
