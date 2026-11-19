-- Indexa a FK usada para filtrar aceitações de privacidade por titular.
create index if not exists account_privacy_acceptances_user_id_idx
  on public.account_privacy_acceptances (user_id);
