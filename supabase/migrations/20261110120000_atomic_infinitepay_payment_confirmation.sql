-- Atomic, idempotent settlement shared by the InfinitePay webhook and browser return.
-- This migration is intentionally staged in Git only; it has not been applied to production.

create or replace function public.confirm_infinitepay_payment(
  p_order_nsu uuid,
  p_transaction_nsu text,
  p_invoice_slug text,
  p_amount_cents bigint,
  p_paid_amount_cents bigint,
  p_capture_method text,
  p_receipt_url text,
  p_installments integer,
  p_dispatch_due_at timestamptz,
  p_delivery_due_at timestamptz
)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_order public.orders%rowtype;
  v_event_id uuid;
  v_event_key text;
  v_now timestamptz := clock_timestamp();
  v_problem text;
begin
  if coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role' then
    raise exception using errcode = '42501', message = 'service_role is required';
  end if;

  if p_order_nsu is null
     or nullif(btrim(coalesce(p_transaction_nsu, '')), '') is null
     or nullif(btrim(coalesce(p_invoice_slug, '')), '') is null then
    raise exception using errcode = '22023', message = 'payment references are required';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_nsu and payment_provider = 'infinitepay'
  for update;

  if not found then
    return jsonb_build_object('outcome', 'not_found', 'newly_paid', false);
  end if;

  v_event_key := 'paid:' || p_order_nsu::text || ':' ||
    coalesce(nullif(btrim(p_transaction_nsu), ''), nullif(btrim(p_invoice_slug), ''), 'no-reference');

  insert into public.payment_provider_events (
    provider, event_key, event_type, order_id, order_nsu, transaction_nsu,
    invoice_slug, amount_cents, paid_amount_cents, capture_method, receipt_url, verified
  ) values (
    'infinitepay', v_event_key, 'paid', v_order.id, p_order_nsu::text,
    p_transaction_nsu, p_invoice_slug, p_amount_cents, p_paid_amount_cents,
    case when p_capture_method in ('pix', 'credit_card') then p_capture_method else null end,
    case when p_receipt_url ~* '^https://' then p_receipt_url else null end,
    false
  )
  on conflict (event_key) do nothing;

  select id into v_event_id
  from public.payment_provider_events
  where event_key = v_event_key
  for update;

  if p_amount_cents is null
     or p_paid_amount_cents is null
     or p_amount_cents <> coalesce(v_order.payment_amount_cents, -1)
     or p_paid_amount_cents < p_amount_cents then
    v_problem := 'Pagamento confirmado pelo provedor, mas o valor não corresponde ao total esperado. Expedição bloqueada para revisão.';
    update public.orders
    set payment_status = 'review_required',
        payment_paid_amount_cents = p_paid_amount_cents,
        payment_invoice_slug = p_invoice_slug,
        payment_receipt_url = case when p_receipt_url ~* '^https://' then p_receipt_url else payment_receipt_url end,
        payment_method = case when p_capture_method in ('pix', 'credit_card') then p_capture_method else payment_method end,
        updated_at = v_now
    where id = v_order.id;

    update public.payment_provider_events
    set verified = true, processed_at = v_now, amount_cents = p_amount_cents,
        paid_amount_cents = p_paid_amount_cents, processing_error = v_problem
    where id = v_event_id;
    return jsonb_build_object('outcome', 'review_required', 'newly_paid', false, 'event_key', v_event_key);
  end if;

  if v_order.payment_status = 'paid' then
    if v_order.payment_transaction_nsu = p_transaction_nsu then
      update public.payment_provider_events
      set verified = true, processed_at = coalesce(processed_at, v_now),
          amount_cents = p_amount_cents, paid_amount_cents = p_paid_amount_cents,
          capture_method = case when p_capture_method in ('pix', 'credit_card') then p_capture_method else capture_method end,
          receipt_url = case when p_receipt_url ~* '^https://' then p_receipt_url else receipt_url end,
          processing_error = null
      where id = v_event_id;
      return jsonb_build_object('outcome', 'duplicate', 'newly_paid', false, 'event_key', v_event_key);
    end if;

    v_problem := 'Foi identificada outra transação para um pedido já pago. Conferência manual necessária.';
    update public.orders set payment_status = 'review_required', updated_at = v_now where id = v_order.id;
    update public.payment_provider_events
    set verified = true, processed_at = v_now, amount_cents = p_amount_cents,
        paid_amount_cents = p_paid_amount_cents, processing_error = v_problem
    where id = v_event_id;
    return jsonb_build_object('outcome', 'review_required', 'newly_paid', false, 'event_key', v_event_key);
  end if;

  if v_order.payment_status <> 'pending'
     or v_order.status <> 'awaiting_confirmation'
     or (v_order.payment_expires_at is not null and v_order.payment_expires_at <= v_now) then
    v_problem := 'Pagamento recebido após expiração, cancelamento ou mudança de estado do pedido. Conferência manual necessária.';
    update public.orders
    set payment_status = 'review_required',
        payment_paid_amount_cents = p_paid_amount_cents,
        payment_invoice_slug = p_invoice_slug,
        payment_receipt_url = case when p_receipt_url ~* '^https://' then p_receipt_url else payment_receipt_url end,
        payment_method = case when p_capture_method in ('pix', 'credit_card') then p_capture_method else payment_method end,
        updated_at = v_now
    where id = v_order.id;
    update public.payment_provider_events
    set verified = true, processed_at = v_now, amount_cents = p_amount_cents,
        paid_amount_cents = p_paid_amount_cents, processing_error = v_problem
    where id = v_event_id;
    return jsonb_build_object('outcome', 'review_required', 'newly_paid', false, 'event_key', v_event_key);
  end if;

  begin
    update public.orders
    set status = 'confirmed',
        payment_status = 'paid',
        payment_transaction_nsu = p_transaction_nsu,
        payment_invoice_slug = p_invoice_slug,
        payment_receipt_url = case when p_receipt_url ~* '^https://' then p_receipt_url else null end,
        payment_method = case when p_capture_method in ('pix', 'credit_card') then p_capture_method else null end,
        payment_paid_amount_cents = p_paid_amount_cents,
        payment_installments = case when p_installments between 1 and 12 then p_installments::smallint else null end,
        paid_at = v_now,
        dispatch_due_at = coalesce(p_dispatch_due_at, v_now),
        delivery_due_at = coalesce(p_delivery_due_at, p_dispatch_due_at, v_now),
        updated_at = v_now
    where id = v_order.id and payment_status = 'pending';

    if v_order.cart_session_id is not null then
      update public.cart_sessions
      set status = 'converted', converted_at = v_now, updated_at = v_now
      where id = v_order.cart_session_id;
    end if;

    update public.payment_provider_events
    set verified = true, processed_at = v_now, amount_cents = p_amount_cents,
        paid_amount_cents = p_paid_amount_cents,
        capture_method = case when p_capture_method in ('pix', 'credit_card') then p_capture_method else null end,
        receipt_url = case when p_receipt_url ~* '^https://' then p_receipt_url else null end,
        processing_error = null,
        email_notification_status = 'pending',
        email_notification_error = null
    where id = v_event_id;
  exception when unique_violation then
    v_problem := 'A transação já está vinculada a outro pedido. Conferência manual necessária.';
    update public.orders set payment_status = 'review_required', updated_at = v_now where id = v_order.id;
    update public.payment_provider_events
    set verified = true, processed_at = v_now, amount_cents = p_amount_cents,
        paid_amount_cents = p_paid_amount_cents, processing_error = v_problem
    where id = v_event_id;
    return jsonb_build_object('outcome', 'review_required', 'newly_paid', false, 'event_key', v_event_key);
  end;

  return jsonb_build_object('outcome', 'paid', 'newly_paid', true, 'event_key', v_event_key);
end;
$$;

revoke all on function public.confirm_infinitepay_payment(
  uuid, text, text, bigint, bigint, text, text, integer, timestamptz, timestamptz
) from public, anon, authenticated;

grant execute on function public.confirm_infinitepay_payment(
  uuid, text, text, bigint, bigint, text, text, integer, timestamptz, timestamptz
) to service_role;

comment on function public.confirm_infinitepay_payment(
  uuid, text, text, bigint, bigint, text, text, integer, timestamptz, timestamptz
) is 'Confirma pagamento InfinitePay de forma atômica, idempotente e exclusiva para service_role.';
