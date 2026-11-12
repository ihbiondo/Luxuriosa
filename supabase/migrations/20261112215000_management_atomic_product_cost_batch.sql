create or replace function public.management_apply_product_cost_batch(
  p_items jsonb,
  p_updated_by uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_item jsonb;
  v_product_id text;
  v_product_name text;
  v_cost_text text;
  v_cost integer;
  v_count integer;
  v_distinct_count integer;
  v_saved integer := 0;
  v_results jsonb := '[]'::jsonb;
begin
  if p_updated_by is null then
    raise exception 'Usuário responsável não informado';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'Os custos devem ser enviados como uma lista de produtos';
  end if;

  select count(*)::integer,
         count(distinct value->>'product_id')::integer
    into v_count, v_distinct_count
  from jsonb_array_elements(p_items) as item(value);

  if v_count < 1 or v_count > 50 then
    raise exception 'Informe de 1 a 50 custos por lote';
  end if;

  if v_count <> v_distinct_count then
    raise exception 'A lista contém produtos repetidos';
  end if;

  for v_item in
    select value
    from jsonb_array_elements(p_items) as item(value)
    order by value->>'product_id'
  loop
    v_product_id := btrim(coalesce(v_item->>'product_id', ''));
    v_product_name := btrim(coalesce(v_item->>'product_name', ''));
    v_cost_text := coalesce(v_item->>'unit_cost_cents', '');

    if v_product_id !~ '^[0-9]{1,100}$'
       or v_product_name = ''
       or char_length(v_product_name) > 180 then
      raise exception 'Produto ou nome inválido no lote de custos';
    end if;

    if v_cost_text !~ '^[0-9]{1,9}$' then
      raise exception 'O custo deve ser informado em centavos, como número inteiro';
    end if;

    v_cost := v_cost_text::integer;
    if v_cost < 0 or v_cost > 100000000 then
      raise exception 'O custo unitário deve ficar entre R$ 0,00 e R$ 1.000.000,00';
    end if;

    insert into public.management_product_costs (
      product_id, product_name, unit_cost_cents, updated_by, updated_at
    ) values (
      v_product_id, v_product_name, v_cost, p_updated_by, now()
    )
    on conflict (product_id) do update
      set product_name = excluded.product_name,
          unit_cost_cents = excluded.unit_cost_cents,
          updated_by = excluded.updated_by,
          updated_at = now();

    v_saved := v_saved + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'unit_cost_cents', v_cost
    ));
  end loop;

  return jsonb_build_object('saved_count', v_saved, 'items', v_results);
end;
$function$;

revoke all on function public.management_apply_product_cost_batch(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.management_apply_product_cost_batch(jsonb, uuid) to service_role;
