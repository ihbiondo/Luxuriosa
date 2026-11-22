-- Exige um perfil mínimo completo e idade mínima de 18 anos para aderir ao Clube.
-- Endereço não é obrigatório: só será solicitado quando houver entrega.

create or replace function private.club_profile_completeness(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_profile record;
  v_missing text[] := array[]::text[];
  v_phone_digits text;
  v_today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if p_user_id is null then
    return jsonb_build_object(
      'profile_complete', false,
      'profile_missing_fields', jsonb_build_array('username', 'full_name', 'birth_date', 'phone', 'email')
    );
  end if;

  select p.username, p.full_name, p.birth_date, p.phone, u.email
    into v_profile
  from auth.users u
  left join public.profiles p on p.id = u.id
  where u.id = p_user_id;

  if not found then
    return jsonb_build_object(
      'profile_complete', false,
      'profile_missing_fields', jsonb_build_array('username', 'full_name', 'birth_date', 'phone', 'email')
    );
  end if;

  v_phone_digits := pg_catalog.regexp_replace(coalesce(v_profile.phone, ''), '[^0-9]', '', 'g');

  if nullif(pg_catalog.btrim(coalesce(v_profile.username, '')), '') is null then
    v_missing := pg_catalog.array_append(v_missing, 'username');
  end if;

  if nullif(pg_catalog.btrim(coalesce(v_profile.full_name, '')), '') is null then
    v_missing := pg_catalog.array_append(v_missing, 'full_name');
  end if;

  if v_profile.birth_date is null or
     v_profile.birth_date > (v_today - interval '18 years')::date then
    v_missing := pg_catalog.array_append(v_missing, 'birth_date');
  end if;

  if v_profile.phone is null or not (
    v_phone_digits ~ '^[1-9][0-9]{9,10}$' or
    v_phone_digits ~ '^55[1-9][0-9]{9,10}$'
  ) then
    v_missing := pg_catalog.array_append(v_missing, 'phone');
  end if;

  if nullif(pg_catalog.btrim(coalesce(v_profile.email, '')), '') is null then
    v_missing := pg_catalog.array_append(v_missing, 'email');
  end if;

  return jsonb_build_object(
    'profile_complete', pg_catalog.cardinality(v_missing) = 0,
    'profile_missing_fields', pg_catalog.to_jsonb(v_missing)
  );
end;
$function$;

revoke all on function private.club_profile_completeness(uuid) from public, anon, authenticated;

create or replace function private.get_club_membership_state()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_profile_state jsonb;
  v_membership_active boolean := false;
  v_joined_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para consultar o Clube.' using errcode = '28000';
  end if;

  v_profile_state := private.club_profile_completeness(v_user_id);

  select m.active, m.joined_at
    into v_membership_active, v_joined_at
  from public.club_memberships m
  where m.user_id = v_user_id;

  return jsonb_build_object(
    'is_member', coalesce(v_membership_active, false) and
      coalesce((v_profile_state ->> 'profile_complete')::boolean, false),
    'membership_active', coalesce(v_membership_active, false),
    'joined_at', case
      when coalesce(v_membership_active, false) and
           coalesce((v_profile_state ->> 'profile_complete')::boolean, false)
      then v_joined_at else null end,
    'profile_complete', coalesce((v_profile_state ->> 'profile_complete')::boolean, false),
    'profile_missing_fields', coalesce(v_profile_state -> 'profile_missing_fields', '[]'::jsonb),
    'personalization', coalesce((
      select c.granted from public.account_data_consents c
      where c.user_id = v_user_id and c.purpose = 'experience_personalization'
      order by c.created_at desc, c.id desc limit 1
    ), false),
    'anonymous_statistics', coalesce((
      select c.granted from public.account_data_consents c
      where c.user_id = v_user_id and c.purpose = 'aggregated_insights_sharing'
      order by c.created_at desc, c.id desc limit 1
    ), false),
    'whatsapp_marketing', coalesce((
      select c.granted from public.contact_consents c
      where c.user_id = v_user_id and c.channel = 'whatsapp' and c.purpose = 'marketing'
      order by c.created_at desc, c.id desc limit 1
    ), false)
  );
end;
$function$;

create or replace function private.save_club_membership_preferences(
  p_accept_terms boolean,
  p_personalization boolean,
  p_anonymous_statistics boolean,
  p_whatsapp_marketing boolean
)
returns timestamptz
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing_active boolean := false;
  v_joined_at timestamptz;
  v_now timestamptz := now();
  v_profile_state jsonb;
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para atualizar suas escolhas.' using errcode = '28000';
  end if;

  if p_accept_terms is null or p_personalization is null
     or p_anonymous_statistics is null or p_whatsapp_marketing is null then
    raise exception 'Revise todas as opções antes de continuar.' using errcode = '22023';
  end if;

  v_profile_state := private.club_profile_completeness(v_user_id);

  if p_accept_terms and
     coalesce((v_profile_state ->> 'profile_complete')::boolean, false) = false then
    raise exception 'Para entrar no Clube, complete seu usuário, nome completo, data de nascimento (18+), WhatsApp e e-mail no cadastro. O endereço continua opcional.' using errcode = '22023';
  end if;

  select m.active into v_existing_active
  from public.club_memberships m
  where m.user_id = v_user_id
  for update;

  if coalesce(v_existing_active, false) = false and p_accept_terms = true then
    insert into public.club_memberships (user_id, active, joined_at, terms_version)
    values (v_user_id, true, v_now, 'luxuriosa-club-terms-v1-2026-11')
    on conflict (user_id) do update
      set active = true,
          left_at = null,
          joined_at = case
            when public.club_memberships.active = false then excluded.joined_at
            else public.club_memberships.joined_at
          end,
          terms_version = excluded.terms_version,
          updated_at = v_now;
  end if;

  insert into public.account_data_consents
    (user_id, purpose, granted, source, consent_text_version, event_key)
  values
    (v_user_id, 'experience_personalization', p_personalization,
     'account_settings', 'luxuriosa-account-data-v2-2026-11', gen_random_uuid()),
    (v_user_id, 'aggregated_insights_sharing', p_anonymous_statistics,
     'account_settings', 'luxuriosa-account-data-v2-2026-11', gen_random_uuid());

  insert into public.contact_consents
    (user_id, channel, purpose, granted, source, consent_text_version, granted_at, revoked_at)
  values
    (v_user_id, 'whatsapp', 'marketing', p_whatsapp_marketing, 'account',
     'luxuriosa-club-marketing-v1-2026-11',
     case when p_whatsapp_marketing then v_now else null end,
     case when p_whatsapp_marketing then null else v_now end);

  if coalesce((v_profile_state ->> 'profile_complete')::boolean, false) then
    select m.joined_at into v_joined_at
    from public.club_memberships m
    where m.user_id = v_user_id and m.active = true;
  end if;

  return v_joined_at;
end;
$function$;

comment on function private.club_profile_completeness(uuid) is
  'Valida os dados mínimos exigidos para adesão ao Clube Luxuriosa, incluindo idade mínima de 18 anos; endereço não é obrigatório.';
