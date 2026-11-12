CREATE OR REPLACE FUNCTION public.sync_online_order_to_management_sale(p_order_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'extensions'
AS $function$
declare
  v_order public.orders%rowtype;
  v_admin_id uuid;
  v_sale_id uuid;
  v_items jsonb;
  v_product_subtotal_cents bigint;
  v_shipping_cents bigint;
  v_discount_cents bigint;
  v_sales_subtotal_cents bigint;
  v_total_cents bigint;
  v_payment_method text;
  v_request_hash text;
  v_error text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
    and source = 'website'
    and payment_provider = 'infinitepay'
    and payment_status = 'paid'
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_ready', 'synced', false);
  end if;

  if v_order.management_sales_sync_status = 'synced'
     and v_order.management_sale_id is not null then
    return jsonb_build_object(
      'outcome', 'already_synced',
      'synced', true,
      'sale_id', v_order.management_sale_id
    );
  end if;

  select id into v_sale_id
  from public.management_sales
  where source_order_id = v_order.id;

  if v_sale_id is not null then
    update public.orders
    set management_sale_id = v_sale_id,
        management_sales_sync_status = 'synced',
        management_sales_sync_error = null,
        management_sales_synced_at = coalesce(management_sales_synced_at, now()),
        updated_at = now()
    where id = v_order.id;

    return jsonb_build_object('outcome', 'already_synced', 'synced', true, 'sale_id', v_sale_id);
  end if;

  select user_id into v_admin_id
  from public.user_permissions
  where role = 'admin'
  order by created_at asc, user_id asc
  limit 1;

  if v_admin_id is null then
    update public.orders
    set management_sales_sync_status = 'error',
        management_sales_sync_error = 'Nenhum usuário administrador está configurado para receber as vendas no Gestão.',
        updated_at = now()
    where id = v_order.id;
    return jsonb_build_object('outcome', 'error', 'synced', false);
  end if;

  begin
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', item.product_id,
          'product_name', item.product_name,
          'quantity', item.quantity,
          'unit_price_cents', item.unit_price_cents,
          'line_total_cents', item.line_total_cents,
          'unit_cost_cents', item.unit_cost_cents,
          'sku', item.sku
        )
        order by item.created_at, item.id
      ),
      '[]'::jsonb
    )
    into v_items
    from (
      select
        oi.id,
        oi.created_at,
        oi.product_id,
        oi.product_name,
        oi.quantity,
        round(oi.unit_price * 100)::bigint as unit_price_cents,
        round(coalesce(oi.line_total, oi.unit_price * oi.quantity) * 100)::bigint as line_total_cents,
        oi.sku,
        case
          when exists (
            select 1
            from public.management_kit_components kc
            where kc.kit_product_id = oi.product_id
          ) then (
            select case
              when count(*) > 0 and count(cost.unit_cost_cents) = count(*) then
                sum(kc.quantity * cost.unit_cost_cents)::bigint
              else null::bigint
            end
            from public.management_kit_components kc
            left join public.management_product_costs cost
              on cost.product_id = kc.component_product_id
            where kc.kit_product_id = oi.product_id
          )
          else (
            select cost.unit_cost_cents
            from public.management_product_costs cost
            where cost.product_id = oi.product_id
          )
        end as unit_cost_cents
      from public.order_items oi
      where oi.order_id = v_order.id
    ) item;

    -- Add the chosen free dice component as a zero-price sale line.
    -- This lets the existing inventory trigger decrement exactly the selected
    -- variant without charging the customer or expanding all three variants.
    select v_items || coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', chosen.product_id,
          'product_name', chosen.product_name,
          'quantity', oi.quantity * chosen.quantity,
          'unit_price_cents', 0,
          'line_total_cents', 0,
          'unit_cost_cents', cost.unit_cost_cents,
          'sku', null
        )
        order by oi.created_at, oi.id, chosen.product_id
      ),
      '[]'::jsonb
    )
    into v_items
    from public.order_items oi
    cross join lateral jsonb_to_recordset(
      case
        when jsonb_typeof(oi.product_snapshot->'selected_components') = 'array'
          then oi.product_snapshot->'selected_components'
        else '[]'::jsonb
      end
    ) as chosen(product_id text, product_name text, quantity integer)
    left join public.management_product_costs cost
      on cost.product_id = chosen.product_id
    where oi.order_id = v_order.id;

    if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) < 1 then
      raise exception 'O pedido não possui itens válidos para sincronizar.';
    end if;

    v_product_subtotal_cents := round(v_order.subtotal * 100)::bigint;
    v_shipping_cents := round(coalesce(v_order.shipping_amount, 0) * 100)::bigint;
    v_discount_cents :=
      coalesce(v_order.club_discount_amount_cents, 0)::bigint
      + round(coalesce(v_order.scheduled_discount_amount, 0) * 100)::bigint;
    v_sales_subtotal_cents := v_product_subtotal_cents + v_shipping_cents;
    v_total_cents := round(v_order.total_amount * 100)::bigint;

    if v_order.payment_amount_cents is not null
       and v_order.payment_amount_cents <> v_total_cents then
      raise exception 'O total persistido no pedido diverge do valor configurado para pagamento.';
    end if;

    if v_total_cents <= 0
       or v_sales_subtotal_cents <= 0
       or v_discount_cents < 0
       or v_sales_subtotal_cents - v_discount_cents <> v_total_cents then
      raise exception 'A composição de subtotal, frete e descontos não fecha com o total do pedido.';
    end if;

    v_payment_method := case v_order.payment_method
      when 'pix' then 'PIX'
      when 'credit_card' then 'CARTAO_CREDITO'
      else 'OUTRO'
    end;

    v_request_hash := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'source', 'website',
            'source_order_id', v_order.id,
            'customer_name', left(v_order.customer_name, 120),
            'items', v_items,
            'subtotal_cents', v_sales_subtotal_cents,
            'shipping_cents', v_shipping_cents,
            'discount_cents', v_discount_cents,
            'total_cents', v_total_cents,
            'payment_method', v_payment_method
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );

    insert into public.management_sales(
      created_by,
      idempotency_key,
      request_hash,
      paid_at,
      customer_name,
      items,
      subtotal_cents,
      discount_cents,
      total_cents,
      payment_method,
      payment_status,
      amount_received_cents,
      change_cents,
      source,
      source_order_id,
      shipping_cents
    ) values (
      v_admin_id,
      v_order.id,
      v_request_hash,
      coalesce(v_order.paid_at, now()),
      left(v_order.customer_name, 120),
      v_items,
      v_sales_subtotal_cents,
      v_discount_cents,
      v_total_cents,
      v_payment_method,
      'paid',
      v_total_cents,
      0,
      'website',
      v_order.id,
      v_shipping_cents
    )
    on conflict do nothing
    returning id into v_sale_id;

    if v_sale_id is null then
      select id into v_sale_id
      from public.management_sales
      where source_order_id = v_order.id
         or (created_by = v_admin_id and idempotency_key = v_order.id)
      order by (source_order_id = v_order.id) desc
      limit 1;
    end if;

    if v_sale_id is null then
      raise exception 'Não foi possível criar ou localizar o lançamento de venda.';
    end if;

    update public.orders
    set management_sale_id = v_sale_id,
        management_sales_sync_status = 'synced',
        management_sales_sync_error = null,
        management_sales_synced_at = now(),
        updated_at = now()
    where id = v_order.id;

  exception when others then
    get stacked diagnostics v_error = message_text;
    update public.orders
    set management_sales_sync_status = 'error',
        management_sales_sync_error = left(coalesce(v_error, 'Falha ao sincronizar venda.'), 1000),
        updated_at = now()
    where id = v_order.id;
    return jsonb_build_object('outcome', 'error', 'synced', false);
  end;

  return jsonb_build_object('outcome', 'synced', 'synced', true, 'sale_id', v_sale_id);
end;
$function$
;
