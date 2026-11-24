-- Remove dados pessoais ligados à conta quando a identidade Auth é excluída.
-- Pedidos e registros financeiros são preservados; seus vínculos com carrinhos
-- são definidos como NULL pelas FKs existentes (ON DELETE SET NULL).
create or replace function private.handle_auth_user_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.account_data_consents
  where user_id = old.id;

  delete from public.account_privacy_acceptances
  where user_id = old.id;

  delete from public.contact_consents
  where user_id = old.id;

  delete from public.delivery_plan_memberships
  where user_id = old.id;

  delete from public.experience_results
  where user_id = old.id;

  delete from public.experience_terms_acceptances
  where user_id = old.id;

  -- A exclusão do carrinho remove dados de navegação e snapshots não convertidos.
  -- Referências em orders são preservadas como NULL pelas constraints existentes.
  delete from public.cart_sessions
  where user_id = old.id;

  -- Remove o perfil; tabelas dependentes (endereços, preferências e Clube)
  -- usam ON DELETE CASCADE.
  delete from public.profiles
  where id = old.id;

  return old;
end;
$$;

revoke all on function private.handle_auth_user_deleted_cleanup() from public, anon, authenticated;

drop trigger if exists on_auth_user_deleted_cleanup on auth.users;

create trigger on_auth_user_deleted_cleanup
after delete on auth.users
for each row
execute function private.handle_auth_user_deleted_cleanup();
