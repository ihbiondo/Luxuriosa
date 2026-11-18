begin;

-- Cada concessão ou revogação deve ficar preservada como evento auditável.
-- A chave do evento torna a gravação idempotente em caso de repetição da requisição.
alter table public.contact_consents
  add column if not exists event_key uuid;

create unique index if not exists contact_consents_event_key_uidx
  on public.contact_consents (event_key)
  where event_key is not null;

create or replace function private.record_contact_consent(
  p_granted boolean,
  p_event_key uuid,
  p_text_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_existing_user_id uuid;
  v_id uuid;
  v_recorded_at timestamptz := clock_timestamp();
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.' using errcode = '28000';
  end if;

  if p_granted is null then
    raise exception 'Informe a escolha de autorização.' using errcode = '22023';
  end if;

  if p_event_key is null then
    raise exception 'Identificador do evento inválido.' using errcode = '22023';
  end if;

  if p_text_version is distinct from 'luxuriosa-contact-marketing-v1-2026-11' then
    raise exception 'Versão do texto de autorização inválida.' using errcode = '22023';
  end if;

  insert into public.contact_consents (
    user_id,
    cart_session_id,
    channel,
    purpose,
    granted,
    source,
    consent_text_version,
    granted_at,
    revoked_at,
    created_at,
    event_key
  )
  values (
    v_user_id,
    null,
    'whatsapp',
    'marketing',
    p_granted,
    'account',
    p_text_version,
    case when p_granted then v_recorded_at else null end,
    case when p_granted then null else v_recorded_at end,
    v_recorded_at,
    p_event_key
  )
  on conflict (event_key) where event_key is not null do nothing
  returning id into v_id;

  if v_id is null then
    select id, user_id
      into v_id, v_existing_user_id
    from public.contact_consents
    where event_key = p_event_key;

    if v_existing_user_id is distinct from v_user_id then
      raise exception 'Identificador de evento já utilizado.' using errcode = '23505';
    end if;
  end if;

  return v_id;
end;
$function$;

-- A função privilegiada permanece fora do schema exposto pela API.
revoke all on function private.record_contact_consent(boolean, uuid, text) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.record_contact_consent(boolean, uuid, text) to authenticated;

create or replace function public.record_contact_consent(
  p_granted boolean,
  p_event_key uuid,
  p_text_version text
)
returns uuid
language sql
set search_path = ''
as $function$
  select private.record_contact_consent(
    p_granted,
    p_event_key,
    p_text_version
  );
$function$;

revoke all on function public.record_contact_consent(boolean, uuid, text) from public, anon;
grant execute on function public.record_contact_consent(boolean, uuid, text) to authenticated;

comment on function public.record_contact_consent(boolean, uuid, text) is
  'Registra consentimento ou revogação do próprio titular para ofertas por WhatsApp.';

commit;
