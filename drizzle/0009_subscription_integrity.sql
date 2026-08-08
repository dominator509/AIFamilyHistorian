alter table subscriptions
  add constraint subscriptions_plan_code_check
  check (plan_code in ('concierge', 'self_service', 'family', 'institutional'));

alter table subscriptions
  add constraint subscriptions_status_check
  check (status in ('trialing', 'active', 'past_due', 'cancelled'));

create unique index subscriptions_current_idx
  on subscriptions(organization_id)
  where status in ('trialing', 'active', 'past_due');
