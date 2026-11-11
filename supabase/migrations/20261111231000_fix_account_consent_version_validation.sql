
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
     or (
       p_text_version is distinct from 'luxuriosa-account-data-v1-2026-11'
       and p_text_version is distinct from 'luxuriosa-account-data-v2-2026-11'
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
