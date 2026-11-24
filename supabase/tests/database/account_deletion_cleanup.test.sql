begin;
select plan(18);

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'account-cleanup-test@example.invalid');

insert into public.profiles (id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')
on conflict (id) do nothing;

insert into public.account_data_consents
  (user_id, purpose, granted, consent_text_version, source, event_key)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'experience_personalization', true,
   'luxuriosa-account-data-v2-2026-11', 'account_settings',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into public.account_privacy_acceptances
  (user_id, notice_version, source, event_key)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'luxuriosa-privacy-v1-2026-11',
   'account_settings', 'ffffffff-ffff-4fff-8fff-ffffffffffff');
insert into public.contact_consents
  (user_id, channel, purpose, granted, source, consent_text_version, event_key)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'whatsapp', 'marketing', true,
   'account', 'luxuriosa-contact-marketing-v1-2026-11',
   'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeef');
insert into public.delivery_plan_memberships (user_id, plan_code)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'supporter');
insert into public.experience_results
  (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   '11111111-1111-4111-8111-111111111111',
   'discovery', 'Descubra seu estilo', 'ferramentas',
   'Resultado fictício', 'Resumo fictício usado apenas no teste de exclusão.');
insert into public.experience_terms_acceptances
  (user_id, terms_version, accepted_at, revoked_at)
values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
   'luxuriosa-experiencias-v1-2026-11', now(), null);

insert into public.cart_instances (id, user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.cart_sessions (id, session_key, user_id)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        '99999999-9999-4999-8999-999999999999',
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.orders (id, cart_session_id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

insert into public.addresses (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_intimate_consent_events (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_intimate_preferences (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_memberships (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_profile_preferences (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.preferences (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.user_permissions (user_id) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

delete from auth.users
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is((select count(*)::int from public.account_data_consents), 0, 'remove consentimentos de dados');
select is((select count(*)::int from public.account_privacy_acceptances), 0, 'remove aceites de privacidade');
select is((select count(*)::int from public.contact_consents), 0, 'remove consentimentos de contato');
select is((select count(*)::int from public.delivery_plan_memberships), 0, 'remove vínculos de entrega');
select is((select count(*)::int from public.experience_results), 0, 'remove resultados de experiências');
select is((select count(*)::int from public.experience_terms_acceptances), 0, 'remove aceites de experiências');
select is((select count(*)::int from public.cart_instances), 0, 'remove carrinhos');
select is((select count(*)::int from public.cart_sessions), 0, 'remove sessões de carrinho');
select is((select count(*)::int from public.profiles), 0, 'remove perfil');
select is((select count(*)::int from public.addresses), 0, 'cascade remove endereços');
select is((select count(*)::int from public.club_intimate_consent_events), 0, 'cascade remove eventos de consentimento do Clube');
select is((select count(*)::int from public.club_intimate_preferences), 0, 'cascade remove preferências íntimas');
select is((select count(*)::int from public.club_memberships), 0, 'cascade remove adesões ao Clube');
select is((select count(*)::int from public.club_profile_preferences), 0, 'cascade remove preferências do perfil do Clube');
select is((select count(*)::int from public.preferences), 0, 'cascade remove preferências');
select is((select count(*)::int from public.user_permissions), 0, 'cascade remove permissões');
select is((select count(*)::int from public.orders), 1, 'preserva pedido histórico');
select is((select cart_session_id is null from public.orders where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), true, 'desvincula sessão de carrinho');

select * from finish();
rollback;
