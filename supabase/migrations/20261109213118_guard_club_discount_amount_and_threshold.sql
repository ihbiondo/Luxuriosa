alter table public.orders
  drop constraint if exists orders_club_discount_amount_limit;

alter table public.orders
  add constraint orders_club_discount_amount_limit
  check (
    club_discount_amount_cents = 0
    or (
      subtotal > 100
      and club_discount_amount_cents <= round(subtotal * 10)
      and club_discount_percent = 10
    )
  );
