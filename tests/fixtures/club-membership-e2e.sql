-- RPC pública mínima para o checkout E2E descartável.
-- A função privada é criada pela migração do Clube antes deste fixture.
-- Este arquivo é copiado apenas para o Supabase local do CI.

grant usage on schema private to authenticated;
grant execute on function private.get_club_membership_state() to authenticated;

create or replace function public.get_club_membership_state()
returns jsonb
language sql
set search_path to ''
as $function$
  select private.get_club_membership_state();
$function$;

revoke all on function public.get_club_membership_state() from public, anon;
grant execute on function public.get_club_membership_state() to authenticated;
