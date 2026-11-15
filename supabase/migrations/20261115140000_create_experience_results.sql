-- Área Minhas conquistas: aceite versionado e resultados privados por titular.

create table if not exists public.experience_terms_acceptances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_version text not null
    check (terms_version = 'luxuriosa-experiencias-v1-2026-11'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint experience_terms_acceptances_state_check check (
    (accepted_at is not null and revoked_at is null)
    or (accepted_at is null and revoked_at is not null)
  )
);

alter table public.experience_terms_acceptances enable row level security;
revoke all on public.experience_terms_acceptances from public, anon, authenticated;
grant select on public.experience_terms_acceptances to authenticated;

create policy experience_terms_acceptances_select_own
  on public.experience_terms_acceptances
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.experience_terms_acceptances is
  'Registra a versão vigente dos Termos de Uso de Experiências e Minhas conquistas aceita pelo titular autenticado.';


create or replace function public.accept_my_experience_terms(p_terms_version text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  if p_terms_version is distinct from 'luxuriosa-experiencias-v1-2026-11' then
    raise exception 'Versão dos termos inválida.';
  end if;

  insert into public.experience_terms_acceptances
    (user_id, terms_version, accepted_at, revoked_at, updated_at)
  values
    (v_user_id, p_terms_version, v_accepted_at, null, v_accepted_at)
  on conflict (user_id) do update
    set terms_version = excluded.terms_version,
        accepted_at = excluded.accepted_at,
        revoked_at = null,
        updated_at = excluded.updated_at;

  return v_accepted_at;
end;
$function$;

revoke all on function public.accept_my_experience_terms(text) from public;
revoke all on function public.accept_my_experience_terms(text) from anon;
grant execute on function public.accept_my_experience_terms(text) to authenticated;

create table if not exists public.experience_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  attempt_id uuid not null,
  activity_id text not null
    check (activity_id ~ '^[a-z0-9_-]{2,60}$'),
  activity_title text not null
    check (char_length(btrim(activity_title)) between 2 and 100),
  category text not null
    check (category in ('prazer', 'relacionamento', 'astrologia', 'noticias', 'ferramentas', 'educacao')),
  result_title text not null
    check (char_length(btrim(result_title)) between 2 and 120),
  result_summary text not null
    check (char_length(btrim(result_summary)) between 2 and 800),
  score smallint,
  score_max smallint,
  created_at timestamptz not null default now(),
  constraint experience_results_score_pair check (
    (score is null and score_max is null)
    or (
      score is not null
      and score_max is not null
      and score >= 0
      and score_max > 0
      and score <= score_max
    )
  ),
  constraint experience_results_attempt_unique unique (user_id, attempt_id)
);

create index if not exists experience_results_user_created_idx
  on public.experience_results (user_id, created_at desc);

alter table public.experience_results enable row level security;
revoke all on public.experience_results from public, anon, authenticated;
grant select, insert, delete on public.experience_results to authenticated;

create policy experience_results_select_own
  on public.experience_results
  for select
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.experience_terms_acceptances as acceptance
      where acceptance.user_id = (select auth.uid())
        and acceptance.terms_version = 'luxuriosa-experiencias-v1-2026-11'
        and acceptance.accepted_at is not null
        and acceptance.revoked_at is null
    )
  );

create policy experience_results_insert_own
  on public.experience_results
  for insert
  to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.experience_terms_acceptances as acceptance
      where acceptance.user_id = (select auth.uid())
        and acceptance.terms_version = 'luxuriosa-experiencias-v1-2026-11'
        and acceptance.accepted_at is not null
        and acceptance.revoked_at is null
    )
  );

create policy experience_results_delete_own
  on public.experience_results
  for delete
  to authenticated
  using (
    (select auth.uid()) = user_id
    and exists (
      select 1
      from public.experience_terms_acceptances as acceptance
      where acceptance.user_id = (select auth.uid())
        and acceptance.terms_version = 'luxuriosa-experiencias-v1-2026-11'
        and acceptance.accepted_at is not null
        and acceptance.revoked_at is null
    )
  );

comment on table public.experience_results is
  'Resultados resumidos salvos voluntariamente pelo titular autenticado após aceite dos termos vigentes. Não armazena respostas individuais.';
comment on column public.experience_results.attempt_id is
  'Identificador idempotente da tentativa, usado para evitar registros duplicados após falhas de conexão.';
comment on column public.experience_results.score is
  'Pontuação educativa opcional; não determina os pontos de conquista.';

create or replace function public.revoke_my_experience_terms()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Autenticação necessária.';
  end if;

  -- Apaga os resultados enquanto o aceite ainda está ativo e a política permite a exclusão.
  delete from public.experience_results
  where user_id = v_user_id;

  update public.experience_terms_acceptances
  set accepted_at = null,
      revoked_at = now(),
      updated_at = now()
  where user_id = v_user_id
    and accepted_at is not null;
end;
$function$;

revoke all on function public.revoke_my_experience_terms() from public;
revoke all on function public.revoke_my_experience_terms() from anon;
grant execute on function public.revoke_my_experience_terms() to authenticated;
