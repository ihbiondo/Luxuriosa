begin;

create extension if not exists pgtap with schema extensions;

select extensions.plan(45);

-- Estrutura e privilégios: o banco precisa bloquear acesso anônimo e escrita
-- direta de aceite, mas permitir que o titular consulte seus próprios dados.
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.experience_terms_acceptances'::regclass),
  'RLS está habilitado na tabela de aceite'
);
select extensions.ok(
  (select relrowsecurity from pg_class where oid = 'public.experience_results'::regclass),
  'RLS está habilitado na tabela de resultados'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.experience_terms_acceptances', 'SELECT'),
  'anon não pode consultar aceites'
);
select extensions.ok(
  not has_table_privilege('anon', 'public.experience_results', 'SELECT'),
  'anon não pode consultar resultados'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.experience_terms_acceptances', 'SELECT'),
  'authenticated pode consultar a própria linha de aceite'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.experience_terms_acceptances', 'INSERT'),
  'authenticated não pode gravar diretamente o aceite'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.experience_terms_acceptances', 'UPDATE'),
  'authenticated não pode alterar diretamente o aceite'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.experience_results', 'INSERT'),
  'authenticated tem privilégio SQL de inserção para resultados'
);
select extensions.ok(
  has_table_privilege('authenticated', 'public.experience_results', 'DELETE'),
  'authenticated pode excluir resultados próprios'
);
select extensions.ok(
  not has_table_privilege('authenticated', 'public.experience_results', 'UPDATE'),
  'authenticated não pode atualizar resultados existentes'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.accept_my_experience_terms(text)', 'EXECUTE'),
  'authenticated pode chamar a função de aceite'
);
select extensions.ok(
  has_function_privilege('authenticated', 'public.revoke_my_experience_terms()', 'EXECUTE'),
  'authenticated pode chamar a função de revogação'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.accept_my_experience_terms(text)', 'EXECUTE'),
  'anon não pode chamar a função de aceite'
);
select extensions.ok(
  not has_function_privilege('anon', 'public.revoke_my_experience_terms()', 'EXECUTE'),
  'anon não pode chamar a função de revogação'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid = 'public.accept_my_experience_terms(text)'::regprocedure),
  'a função de aceite usa SECURITY DEFINER'
);
select extensions.ok(
  (select prosecdef from pg_proc where oid = 'public.revoke_my_experience_terms()'::regprocedure),
  'a função de revogação usa SECURITY DEFINER'
);

-- Contas descartáveis criadas somente dentro desta transação de teste.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('10000000-0000-4000-8000-000000000001', 'conquistas-a@test.invalid',
    jsonb_build_object('username', 'conquistas.a', 'display_name', 'Conta A')),
  ('10000000-0000-4000-8000-000000000002', 'conquistas-b@test.invalid',
    jsonb_build_object('username', 'conquistas.b', 'display_name', 'Conta B'));

-- Pessoa A: sem aceite, não pode abrir o histórico nem gravar resultados.
set local role authenticated;
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select extensions.is(
  (select count(*)::integer from public.experience_terms_acceptances),
  0,
  'conta A começa sem aceite registrado'
);
select extensions.throws_ok(
  $$insert into public.experience_terms_acceptances
    (user_id, terms_version, accepted_at, revoked_at)
    values (
      '10000000-0000-4000-8000-000000000001',
      'luxuriosa-experiencias-v1-2026-11',
      now(),
      null
    )$$,
  '42501',
  null,
  'conta A não pode registrar aceite por INSERT direto'
);
select extensions.throws_ok(
  $$select public.accept_my_experience_terms('versao-invalida')$$,
  'P0001',
  'Versão dos termos inválida.',
  'a função rejeita uma versão de termos desconhecida'
);
select extensions.lives_ok(
  $$select public.accept_my_experience_terms('luxuriosa-experiencias-v1-2026-11')$$,
  'conta A consegue aceitar a versão vigente dos termos'
);
select extensions.ok(
  (select accepted_at is not null and revoked_at is null
   from public.experience_terms_acceptances),
  'o aceite válido é registrado com horário e sem revogação'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000010',
      'invented_activity',
      'Atividade não integrada',
      'ferramentas',
      'Resultado falso',
      'O banco não deve aceitar atividades fora do catálogo.'
    )$$,
  '23514',
  null,
  'o banco rejeita identificador de atividade fora da lista integrada'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000011',
      'discovery',
      'Descubra seu estilo',
      'astrologia',
      'Categoria alterada',
      'A categoria precisa corresponder à definição da atividade.'
    )$$,
  '23514',
  null,
  'o banco rejeita categoria incompatível com a atividade'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000012',
      'discovery',
      'Atividade renomeada',
      'ferramentas',
      'Título alterado',
      'O título da atividade precisa corresponder ao catálogo.'
    )$$,
  '23514',
  null,
  'o banco rejeita título incompatível com a atividade'
);
select extensions.lives_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'discovery',
      'Descubra seu estilo',
      'ferramentas',
      'Resultado A',
      'Resumo privado da conta A.'
    )$$,
  'conta A consegue salvar o próprio resultado após aceitar os termos'
);
select extensions.is(
  (select count(*)::integer from public.experience_results),
  1,
  'conta A consulta apenas seu primeiro resultado'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      'discovery',
      'Descubra seu estilo',
      'ferramentas',
      'Tentativa cruzada',
      'A conta A não pode gravar dados em nome da conta B.'
    )$$,
  '42501',
  null,
  'conta A não pode inserir resultado em nome da conta B'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000001',
      'discovery',
      'Descubra seu estilo',
      'ferramentas',
      'Resultado duplicado',
      'A mesma tentativa não pode ser inserida novamente.'
    )$$,
  '23505',
  null,
  'o banco rejeita tentativa duplicada para a mesma conta'
);
select extensions.throws_ok(
  $$update public.experience_results
    set result_title = 'Alteração não permitida'
    where user_id = '10000000-0000-4000-8000-000000000001'$$,
  '42501',
  null,
  'a conta A não pode atualizar diretamente um resultado salvo'
);

-- Pessoa B: sem aceite, não enxerga o histórico A e não consegue salvar.
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select extensions.is(
  (select count(*)::integer from public.experience_results),
  0,
  'conta B não consegue visualizar o resultado privado de A'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000003',
      'connection',
      'Conexão a dois',
      'relacionamento',
      'Resultado B',
      'A conta B ainda não aceitou os termos.'
    )$$,
  '42501',
  null,
  'conta B não pode salvar antes do aceite'
);
select extensions.lives_ok(
  $$select public.accept_my_experience_terms('luxuriosa-experiencias-v1-2026-11')$$,
  'conta B consegue aceitar os termos na própria conta'
);
select extensions.lives_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000002',
      '20000000-0000-4000-8000-000000000002',
      'connection',
      'Conexão a dois',
      'relacionamento',
      'Resultado B',
      'Resumo privado da conta B.'
    )$$,
  'conta B consegue salvar o próprio resultado após aceitar'
);
select extensions.is(
  (select count(*)::integer from public.experience_results),
  1,
  'conta B enxerga somente seu próprio resultado'
);

-- A volta a consultar: não pode ler nem excluir o registro B.
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select extensions.is(
  (select count(*)::integer from public.experience_results),
  1,
  'conta A continua vendo somente seu próprio resultado'
);
select extensions.lives_ok(
  'delete from public.experience_results where user_id = ''10000000-0000-4000-8000-000000000002''',
  'conta A não consegue excluir resultado de B'
);

-- B confirma que seu resultado continua intacto.
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select extensions.is(
  (select count(*)::integer from public.experience_results),
  1,
  'o resultado de B permanece intacto após a tentativa de exclusão por A'
);

-- A revoga o aceite: o histórico próprio é apagado e novos salvamentos são bloqueados.
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000001';

select extensions.lives_ok(
  $$select public.revoke_my_experience_terms()$$,
  'conta A consegue revogar o aceite pela função própria'
);
select extensions.is(
  (select count(*)::integer from public.experience_results),
  0,
  'a revogação apaga todos os resultados da conta A'
);
select extensions.ok(
  (select accepted_at is null and revoked_at is not null
   from public.experience_terms_acceptances),
  'a revogação fica registrada na linha da conta A'
);
select extensions.throws_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000004',
      'curiosity',
      'Mitos ou verdades?',
      'ferramentas',
      'Resultado após revogação',
      'Este salvamento deve ser bloqueado.'
    )$$,
  '42501',
  null,
  'conta A não pode salvar depois de revogar o aceite'
);
select extensions.lives_ok(
  $$select public.accept_my_experience_terms('luxuriosa-experiencias-v1-2026-11')$$,
  'conta A pode aceitar novamente a versão vigente'
);
select extensions.lives_ok(
  $$insert into public.experience_results
    (user_id, attempt_id, activity_id, activity_title, category, result_title, result_summary)
    values (
      '10000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000005',
      'curiosity',
      'Mitos ou verdades?',
      'ferramentas',
      'Novo resultado A',
      'Um resultado salvo após novo aceite.'
    )$$,
  'conta A pode salvar novamente depois de reaceitar'
);
select extensions.is(
  (select count(*)::integer from public.experience_results),
  1,
  'conta A vê apenas o novo resultado após reaceitar'
);

-- Reconfirma isolamento depois da revogação e da nova aceitação de A.
set local request.jwt.claim.sub = '10000000-0000-4000-8000-000000000002';

select extensions.is(
  (select count(*)::integer from public.experience_results),
  1,
  'a revogação de A não apaga nem revela o resultado privado de B'
);

select * from extensions.finish();
rollback;
