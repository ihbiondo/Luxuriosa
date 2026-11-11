-- Perfil comercial do cliente: interesses voluntários para recomendações e planejamento de estoque.
-- A tabela já possui RLS com leitura/atualização restritas ao próprio usuário.
alter table public.preferences
  add column if not exists favorite_categories text[] not null default '{}'::text[],
  add column if not exists preferred_price_range text,
  add column if not exists preferred_offer_type text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.preferences
  drop constraint if exists preferences_favorite_categories_check;
alter table public.preferences
  add constraint preferences_favorite_categories_check
  check (
    cardinality(favorite_categories) <= 3
    and favorite_categories <@ array[
      'lingerie',
      'cosmeticos_sensuais',
      'geles_lubrificantes',
      'acessorios_casais',
      'jogos_brincadeiras',
      'massagem_relaxamento',
      'estimulacao',
      'fantasias_acessorios',
      'kits_presentes',
      'novidades_lancamentos'
    ]::text[]
  );

alter table public.preferences
  drop constraint if exists preferences_preferred_price_range_check;
alter table public.preferences
  add constraint preferences_preferred_price_range_check
  check (
    preferred_price_range is null
    or preferred_price_range in ('ate_50', '50_100', '100_200', 'acima_200')
  );

alter table public.preferences
  drop constraint if exists preferences_preferred_offer_type_check;
alter table public.preferences
  add constraint preferences_preferred_offer_type_check
  check (
    preferred_offer_type is null
    or preferred_offer_type in ('descontos', 'kits', 'novidades', 'recomendacoes')
  );

create or replace function public.touch_preferences_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists preferences_touch_updated_at on public.preferences;
create trigger preferences_touch_updated_at
before update on public.preferences
for each row execute function public.touch_preferences_updated_at();

revoke all on function public.touch_preferences_updated_at() from public, anon, authenticated;

-- Mantém clientes que ainda usam a versão anterior do site funcionando durante a publicação.
create or replace function public.record_account_data_consent(
  p_purpose text,
  p_granted boolean,
  p_source text,
  p_event_key uuid,
  p_text_version text
)
returns uuid
language plpgsql
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;
  if p_purpose not in ('experience_personalization','aggregated_insights_sharing') then
    raise exception 'Finalidade de consentimento inválida.';
  end if;
  if p_source not in ('signup','account_settings') then
    raise exception 'Origem de consentimento inválida.';
  end if;
  if p_event_key is null
     or p_text_version not in (
       'luxuriosa-account-data-v1-2026-11',
       'luxuriosa-account-data-v2-2026-11'
     ) then
    raise exception 'Registro de consentimento inválido.';
  end if;

  insert into public.account_data_consents
    (user_id, purpose, granted, source, consent_text_version, event_key)
  values
    (v_user_id, p_purpose, p_granted, p_source, p_text_version, p_event_key)
  on conflict (event_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id
    from public.account_data_consents
    where event_key = p_event_key
      and user_id = v_user_id;
  end if;
  return v_id;
end;
$function$;
