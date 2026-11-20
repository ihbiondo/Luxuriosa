begin;

-- Os timestamps dos eventos de consentimento são dados de auditoria:
-- o navegador não pode escolher a data de concessão ou revogação.
create schema if not exists private;

create or replace function private.enforce_consent_event_created_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' then
    new.created_at := pg_catalog.clock_timestamp();
  else
    -- Mesmo operações privilegiadas não podem reescrever a data original.
    new.created_at := old.created_at;
  end if;

  return new;
end;
$function$;

-- A função é usada apenas pelos gatilhos e não deve ser uma RPC da API.
revoke all on function private.enforce_consent_event_created_at()
  from public, anon, authenticated;

drop trigger if exists account_data_consents_enforce_created_at
  on public.account_data_consents;
create trigger account_data_consents_enforce_created_at
  before insert or update on public.account_data_consents
  for each row
  execute function private.enforce_consent_event_created_at();

drop trigger if exists club_intimate_consent_events_enforce_created_at
  on public.club_intimate_consent_events;
create trigger club_intimate_consent_events_enforce_created_at
  before insert or update on public.club_intimate_consent_events
  for each row
  execute function private.enforce_consent_event_created_at();

comment on function private.enforce_consent_event_created_at() is
  'Gera created_at no banco e preserva o timestamp original nos eventos de consentimento.';

commit;
