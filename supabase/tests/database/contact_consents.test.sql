begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(18);

select extensions.ok(
  (select relrowsecurity from pg_class where oid='public.contact_consents'::regclass),
  'RLS está habilitado para os consentimentos de contato'
);
select extensions.ok(
  has_table_privilege('authenticated','public.contact_consents','SELECT'),
  'cliente autenticado pode consultar seus próprios eventos'
);
select extensions.ok(
  not has_table_privilege('anon','public.contact_consents','SELECT'),
  'visitante anônimo não pode consultar eventos'
);
select extensions.ok(
  not has_table_privilege('authenticated','public.contact_consents','INSERT'),
  'cliente não pode inserir eventos diretamente'
);
select extensions.ok(
  not has_table_privilege('authenticated','public.contact_consents','UPDATE'),
  'cliente não pode alterar eventos diretamente'
);
select extensions.ok(
  has_function_privilege('authenticated','public.record_contact_consent(boolean,uuid,text)','EXECUTE'),
  'cliente autenticado pode chamar a função pública de registro'
);
select extensions.ok(
  not has_function_privilege('anon','public.record_contact_consent(boolean,uuid,text)','EXECUTE'),
  'visitante anônimo não pode chamar a função'
);
select extensions.ok(
  not (select prosecdef from pg_proc where oid='public.record_contact_consent(boolean,uuid,text)'::regprocedure),
  'wrapper público não executa com privilégios elevados'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid='private.record_contact_consent(boolean,uuid,text)'::regprocedure),
  'função interna usa SECURITY DEFINER'
);

insert into auth.users (id,email)
values
  ('30000000-0000-4000-8000-000000000001','consent-a@test.invalid'),
  ('31000000-0000-4000-8000-000000000002','consent-b@test.invalid');

set local role authenticated;
set local request.jwt.claim.sub='30000000-0000-4000-8000-000000000001';

select extensions.lives_ok(
  $$select public.record_contact_consent(true,'40000000-0000-4000-8000-000000000001','luxuriosa-contact-marketing-v1-2026-11')$$,
  'cliente consegue conceder autorização para ofertas por WhatsApp'
);
select extensions.is(
  (select count(*)::integer from public.contact_consents where user_id=auth.uid() and channel='whatsapp' and purpose='marketing'),
  1,
  'a concessão fica registrada para o próprio titular'
);
select extensions.is(
  public.record_contact_consent(true,'40000000-0000-4000-8000-000000000001','luxuriosa-contact-marketing-v1-2026-11'),
  (select id from public.contact_consents where event_key='40000000-0000-4000-8000-000000000001'),
  'repetir a mesma chave retorna o mesmo evento sem duplicar'
);
select extensions.is(
  (select count(*)::integer from public.contact_consents where user_id=auth.uid() and channel='whatsapp' and purpose='marketing'),
  1,
  'a repetição não cria um segundo evento'
);
select extensions.lives_ok(
  $$select public.record_contact_consent(false,'40000000-0000-4000-8000-000000000002','luxuriosa-contact-marketing-v1-2026-11')$$,
  'cliente consegue revogar a autorização'
);
select extensions.ok(
  (select granted=false and revoked_at is not null
   from public.contact_consents
   where event_key='40000000-0000-4000-8000-000000000002'),
  'a revogação é registrada como novo evento imutável'
);
select extensions.throws_ok(
  $$select public.record_contact_consent(true,'40000000-0000-4000-8000-000000000003','versao-invalida')$$,
  '22023',
  'Versão do texto de autorização inválida.',
  'a função rejeita versão de texto não aprovada'
);

set local request.jwt.claim.sub='31000000-0000-4000-8000-000000000002';

select extensions.is(
  (select count(*)::integer from public.contact_consents),
  0,
  'outro cliente não visualiza os eventos do primeiro'
);
select extensions.throws_ok(
  $$select public.record_contact_consent(true,'40000000-0000-4000-8000-000000000001','luxuriosa-contact-marketing-v1-2026-11')$$,
  '23505',
  'Identificador de evento já utilizado.',
  'um cliente não consegue reutilizar chave pertencente a outro'
);

select * from extensions.finish();
rollback;
