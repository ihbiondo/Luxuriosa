-- Remove o perfil e seus dados dependentes quando a identidade Auth é excluída.
-- Os pedidos e registros financeiros não referenciam profiles e permanecem intactos.
create or replace function private.handle_auth_user_deleted_cleanup()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
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
