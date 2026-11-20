begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(21);

select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.account_data_consents'::regclass),
  'RLS continua habilitado nos eventos de consentimento de conta'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.club_intimate_consent_events'::regclass),
  'RLS continua habilitado nos eventos de consentimento íntimo'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.account_data_consents', 'INSERT'),
  'a conta autenticada conserva a capacidade de registrar as próprias escolhas'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.club_intimate_consent_events', 'INSERT'),
  'a conta autenticada conserva a capacidade de registrar o próprio consentimento íntimo'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.account_data_consents', 'INSERT'),
  'visitantes anônimos não podem inserir eventos de consentimento de conta'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.club_intimate_consent_events', 'INSERT'),
  'visitantes anônimos não podem inserir eventos de consentimento íntimo'
);
select extensions.ok(
  not has_function_privilege('authenticated', 'private.enforce_consent_event_created_at()', 'EXECUTE'),
  'o cliente autenticado não pode chamar a função interna do gatilho como RPC'
);
select extensions.ok(
  not has_function_privilege('anon', 'private.enforce_consent_event_created_at()', 'EXECUTE'),
  'o visitante anônimo não pode chamar a função interna do gatilho'
);
select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.account_data_consents'::regclass
      and tgname = 'account_data_consents_enforce_created_at'
      and not tgisinternal
  ),
  'o gatilho de timestamp está instalado nos eventos de conta'
);
select extensions.ok(
  exists (
    select 1 from pg_trigger
    where tgrelid = 'public.club_intimate_consent_events'::regclass
      and tgname = 'club_intimate_consent_events_enforce_created_at'
      and not tgisinternal
  ),
  'o gatilho de timestamp está instalado nos eventos íntimos'
);

insert into auth.users (id, email)
values
  ('30000000-0000-4000-8000-000000000001', 'timestamp-a@test.invalid'),
  ('31000000-0000-4000-8000-000000000002', 'timestamp-b@test.invalid');

set local role authenticated;
set local request.jwt.claim.sub = '30000000-0000-4000-8000-000000000001';

select extensions.lives_ok(
  $$insert into public.account_data_consents
    (user_id, purpose, granted, source, consent_text_version, event_key, created_at)
    values (
      '30000000-0000-4000-8000-000000000001',
      'experience_personalization',
      true,
      'account_settings',
      'luxuriosa-account-data-v2-2026-11',
      '40000000-0000-4000-8000-000000000001',
      '1900-01-01 00:00:00+00'
    )$$,
  'a conta registra consentimento mesmo quando envia um timestamp adulterado'
);
select extensions.ok(
  (select created_at between pg_catalog.clock_timestamp() - interval '1 minute'
     and pg_catalog.clock_timestamp() + interval '1 minute'
   from public.account_data_consents
   where event_key = '40000000-0000-4000-8000-000000000001'),
  'o banco substitui a data antiga enviada pelo navegador pela data real do registro'
);

select extensions.lives_ok(
  $$insert into public.club_intimate_consent_events
    (user_id, granted, consent_version, source, event_key, created_at)
    values (
      '30000000-0000-4000-8000-000000000001',
      true,
      'luxuriosa-intimate-profile-v1-2026-11',
      'account_settings',
      '40000000-0000-4000-8000-000000000002',
      '2999-01-01 00:00:00+00'
    )$$,
  'a conta registra consentimento íntimo mesmo quando envia um timestamp futuro'
);
select extensions.ok(
  (select created_at between pg_catalog.clock_timestamp() - interval '1 minute'
     and pg_catalog.clock_timestamp() + interval '1 minute'
   from public.club_intimate_consent_events
   where event_key = '40000000-0000-4000-8000-000000000002'),
  'o banco substitui a data futura enviada pelo navegador pela data real do registro'
);

-- A segunda conta não pode criar eventos em nome da primeira nem ler seus registros.
set local request.jwt.claim.sub = '31000000-0000-4000-8000-000000000002';

select extensions.throws_ok(
  $$insert into public.account_data_consents
    (user_id, purpose, granted, source, consent_text_version, event_key, created_at)
    values (
      '30000000-0000-4000-8000-000000000001',
      'experience_personalization',
      true,
      'account_settings',
      'luxuriosa-account-data-v2-2026-11',
      '40000000-0000-4000-8000-000000000003',
      '2999-01-01 00:00:00+00'
    )$$,
  '42501',
  null,
  'a conta B não pode gravar um evento em nome da conta A'
);
select extensions.is(
  (select count(*)::integer from public.account_data_consents),
  0,
  'a conta B não consegue consultar os eventos privados de A'
);
select extensions.is(
  (select count(*)::integer from public.club_intimate_consent_events),
  0,
  'a conta B não consegue consultar os eventos íntimos privados de A'
);

-- Mesmo uma operação privilegiada não pode reescrever o horário original.
reset role;

update public.account_data_consents
set created_at = '1900-01-01 00:00:00+00'
where event_key = '40000000-0000-4000-8000-000000000001';
select extensions.ok(
  (select created_at between pg_catalog.clock_timestamp() - interval '1 minute'
     and pg_catalog.clock_timestamp() + interval '1 minute'
   from public.account_data_consents
   where event_key = '40000000-0000-4000-8000-000000000001'),
  'uma atualização privilegiada não altera o timestamp original do evento de conta'
);

update public.club_intimate_consent_events
set created_at = '2999-01-01 00:00:00+00'
where event_key = '40000000-0000-4000-8000-000000000002';
select extensions.ok(
  (select created_at between pg_catalog.clock_timestamp() - interval '1 minute'
     and pg_catalog.clock_timestamp() + interval '1 minute'
   from public.club_intimate_consent_events
   where event_key = '40000000-0000-4000-8000-000000000002'),
  'uma atualização privilegiada não altera o timestamp original do evento íntimo'
);

select * from extensions.finish();
rollback;
