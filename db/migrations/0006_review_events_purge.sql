-- 0006 — refine the review_events append-only trigger.
-- The privileged purge flag (app.purge_audit = 'on') now permits UPDATE as well
-- as DELETE, so deleting an actor account — whose FK nulls review_events.actor_id
-- via ON DELETE SET NULL (an UPDATE) — is not blocked during a deliberate purge.
-- Without the flag, all mutation of a past event remains rejected.

create or replace function public.prevent_review_event_mutation()
returns trigger language plpgsql as $$
begin
  if current_setting('app.purge_audit', true) = 'on' then
    return coalesce(new, old);
  end if;
  raise exception 'review_events is append-only; % is not permitted', tg_op;
end $$;
