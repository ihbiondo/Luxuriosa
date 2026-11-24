begin;
select plan(19);

insert into auth.users (id, email)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'account-cleanup-test@example.invalid');

insert into public.profiles (id)
values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.account_data_consents values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.account_privacy_acceptances values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.contact_consents values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.delivery_plan_memberships values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.experience_results values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.experience_terms_acceptances values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

insert into public.cart_instances (id, user_id)
values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.cart_sessions (id, user_id)
values ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.orders (id, cart_instance_id, cart_session_id)
values ('dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc');

insert into public.addresses values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_intimate_consent_events values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_intimate_preferences values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_memberships values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.club_profile_preferences values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.preferences values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
insert into public.user_permissions values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

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
select is((select cart_instance_id is null from public.orders where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), true, 'desvincula carrinho do pedido');
select is((select cart_session_id is null from public.orders where id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'), true, 'desvincula sessão do pedido');

select * from finish();
rollback;
