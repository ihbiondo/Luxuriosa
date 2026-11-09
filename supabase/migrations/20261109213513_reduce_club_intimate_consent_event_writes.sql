create or replace function public.save_club_intimate_preferences(
  p_experience_level smallint,
  p_novelty_code smallint,
  p_context_code smallint,
  p_intensity_code smallint,
  p_desired_codes text[],
  p_category_codes text[],
  p_sensation_codes text[],
  p_avoid_codes text[]
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Entre na sua conta para salvar a ficha de afinidade.' using errcode = '28000';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Perfil do Clube não encontrado.' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.club_intimate_preferences
    where user_id = v_user_id
      and consent_version = 'luxuriosa-intimate-profile-v1-2026-11'
  ) then
    insert into public.club_intimate_consent_events
      (user_id, granted, consent_version, source, event_key)
    values
      (v_user_id, true, 'luxuriosa-intimate-profile-v1-2026-11', 'account_settings', gen_random_uuid());
  end if;

  insert into public.club_intimate_preferences (
    user_id, experience_level, novelty_code, context_code, intensity_code,
    recommendation_tone_code, desired_codes, category_codes, sensation_codes,
    avoid_codes, consent_version, consented_at, updated_at
  ) values (
    v_user_id, p_experience_level, p_novelty_code, p_context_code, p_intensity_code,
    1, coalesce(p_desired_codes, '{}'), coalesce(p_category_codes, '{}'),
    coalesce(p_sensation_codes, '{}'), coalesce(p_avoid_codes, '{}'),
    'luxuriosa-intimate-profile-v1-2026-11', now(), now()
  )
  on conflict (user_id) do update set
    experience_level = excluded.experience_level,
    novelty_code = excluded.novelty_code,
    context_code = excluded.context_code,
    intensity_code = excluded.intensity_code,
    recommendation_tone_code = excluded.recommendation_tone_code,
    desired_codes = excluded.desired_codes,
    category_codes = excluded.category_codes,
    sensation_codes = excluded.sensation_codes,
    avoid_codes = excluded.avoid_codes,
    consent_version = excluded.consent_version,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.save_club_intimate_preferences(
  smallint, smallint, smallint, smallint, text[], text[], text[], text[]
) from public, anon;
grant execute on function public.save_club_intimate_preferences(
  smallint, smallint, smallint, smallint, text[], text[], text[], text[]
) to authenticated;
