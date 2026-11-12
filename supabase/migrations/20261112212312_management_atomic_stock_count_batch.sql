create or replace function public.management_apply_stock_count_batch(
  p_items jsonb,
  p_created_by uuid,
  p_note text default 'Contagem física em lote'
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
  v_quantity_text text;
  v_minimum_text text;
  v_counted integer;
  v_minimum integer;
  v_current public.management_inventory%rowtype;
  v_delta integer;
  v_item_count integer;
  v_distinct_count integer;
  v_updated_count integer := 0;
  v_movement_count integer := 0;
  v_results jsonb := '[]'::jsonb;
  v_note text;
begin
  if p_created_by is null then
    raise exception 'Usuário responsável pela contagem não informado';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'A contagem deve ser enviada como uma lista de produtos';
  end if;

  v_item_count := jsonb_array_length(p_items);
  if v_item_count < 1 or v_item_count > 50 then
    raise exception 'Informe de 1 a 50 produtos por conferência';
  end if;

  select count(*)::integer,
         count(distinct value->>'product_id')::integer
    into v_item_count, v_distinct_count
  from jsonb_array_elements(p_items) as item(value);

  if v_item_count <> v_distinct_count then
    raise exception 'A lista contém produtos repetidos';
  end if;

  v_note := coalesce(nullif(left(btrim(coalesce(p_note, '')), 500), ''), 'Contagem física em lote');

  -- Lock rows in stable product-id order to avoid deadlocks between concurrent batches.
  for v_item in
    select value
    from jsonb_array_elements(p_items) as item(value)
    order by value->>'product_id'
  loop
    v_product_id := btrim(coalesce(v_item->>'product_id', ''));
    v_product_name := btrim(coalesce(v_item->>'product_name', ''));
    v_quantity_text := coalesce(v_item->>'quantity_on_hand', '');
    v_minimum_text := coalesce(v_item->>'reorder_point', '');

    if v_product_id !~ '^[0-9]{1,100}$'
       or v_product_name = ''
       or char_length(v_product_name) > 180 then
      raise exception 'Produto ou nome inválido na contagem';
    end if;

    if v_quantity_text !~ '^[0-9]{1,7}$'
       or v_minimum_text !~ '^[0-9]{1,7}$' then
      raise exception 'Saldo físico e estoque mínimo devem ser números inteiros';
    end if;

    v_counted := v_quantity_text::integer;
    v_minimum := v_minimum_text::integer;

    if v_counted < 0 or v_counted > 1000000
       or v_minimum < 0 or v_minimum > 1000000 then
      raise exception 'Quantidades devem ficar entre zero e 1.000.000';
    end if;

    insert into public.management_inventory (
      product_id, product_name, quantity_on_hand, reorder_point, stock_control_enabled
    ) values (
      v_product_id, v_product_name, 0, 0, false
    )
    on conflict (product_id) do nothing;

    select *
      into v_current
    from public.management_inventory
    where product_id = v_product_id
    for update;

    if not found then
      raise exception 'Não foi possível bloquear o produto %', v_product_id;
    end if;

    v_delta := v_counted - v_current.quantity_on_hand;

    update public.management_inventory
    set product_name = v_product_name,
        quantity_on_hand = v_counted,
        reorder_point = v_minimum,
        stock_control_enabled = true,
        updated_at = now()
    where product_id = v_product_id;

    if v_delta <> 0 then
      insert into public.management_inventory_movements (
        product_id, product_name, movement_type, quantity_delta,
        balance_after, note, created_by
      ) values (
        v_product_id, v_product_name, 'adjustment', v_delta,
        v_counted, v_note, p_created_by
      );
      v_movement_count := v_movement_count + 1;
    end if;

    v_updated_count := v_updated_count + 1;
    v_results := v_results || jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id,
      'product_name', v_product_name,
      'previous_balance', v_current.quantity_on_hand,
      'quantity_on_hand', v_counted,
      'quantity_delta', v_delta,
      'reorder_point', v_minimum,
      'stock_control_enabled', true
    ));
  end loop;

  return jsonb_build_object(
    'updated_count', v_updated_count,
    'movement_count', v_movement_count,
    'items', v_results
  );
end;
$function$;

revoke all on function public.management_apply_stock_count_batch(jsonb, uuid, text) from public, anon, authenticated;
grant execute on function public.management_apply_stock_count_batch(jsonb, uuid, text) to service_role;
