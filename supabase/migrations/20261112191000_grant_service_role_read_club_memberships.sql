-- Permit the trusted cart-orders Edge Function to verify active Club membership.
-- The table remains inaccessible to public and authenticated client roles.
grant select on public.club_memberships to service_role;
