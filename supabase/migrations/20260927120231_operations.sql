begin;
alter table public.gateway_tickets drop constraint gateway_tickets_email_status_check;
alter table public.gateway_tickets add constraint gateway_tickets_email_status_check check(email_status in ('queued','provider_accepted','failed','delivered','bounced','complained','delayed'));
alter table public.gateway_events add column actor text;
create unique index gateway_outbox_provider on public.gateway_outbox(provider_id) where provider_id is not null;
create index gateway_tickets_retention on public.gateway_tickets(created_at);
create table public.gateway_delivery_events (
  event_id text primary key check(length(event_id)<=200),
  provider_id text not null check(length(provider_id)<=200),
  status text not null check(status in ('delivered','bounced','complained','failed','delayed')),
  occurred_at timestamptz not null, received_at timestamptz not null default now()
);
create index gateway_delivery_provider on public.gateway_delivery_events(provider_id);
create table public.gateway_maintenance (
  id boolean primary key default true check(id), last_pruned_at timestamptz
);
insert into public.gateway_maintenance(id) values(true);
alter table public.gateway_delivery_events enable row level security;
alter table public.gateway_maintenance enable row level security;
revoke all on public.gateway_delivery_events, public.gateway_maintenance from public,anon,authenticated;
grant all on public.gateway_delivery_events, public.gateway_maintenance to service_role;

-- Terminal outcomes outrank temporary delays even when notifications arrive late.
create function public.gateway_delivery_status(p_provider text) returns text language sql stable set search_path='' as $$
  select status from public.gateway_delivery_events where provider_id=p_provider
  order by case status when 'complained' then 5 when 'bounced' then 4 when 'failed' then 3 when 'delivered' then 2 else 1 end desc,occurred_at desc,event_id desc limit 1;
$$;
create function public.gateway_email_event(p_event_id text,p_provider_id text,p_status text,p_occurred_at timestamptz)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.gateway_outbox; begin
  -- Same lock order as finish_email: provider, outbox, ticket. This also handles
  -- a webhook arriving before the sending worker commits its acknowledgement.
  perform pg_advisory_xact_lock(hashtextextended('provider:'||p_provider_id,0));
  insert into public.gateway_delivery_events(event_id,provider_id,status,occurred_at)
    values(p_event_id,p_provider_id,p_status,p_occurred_at) on conflict do nothing;
  if not found then return false; end if;
  select * into job from public.gateway_outbox where provider_id=p_provider_id for update;
  if job.id is not null then
    update public.gateway_tickets set email_status=public.gateway_delivery_status(p_provider_id),updated_at=now() where id=job.ticket_id;
    insert into public.gateway_events(ticket_id,kind) values(job.ticket_id,'delivery_'||p_status);
  end if;
  return true;
end $$;

create or replace function public.gateway_finish_email(p_id uuid,p_lease uuid,p_provider text,p_error text,p_retryable boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.gateway_outbox; next_state text; begin
  if p_provider is not null then perform pg_advisory_xact_lock(hashtextextended('provider:'||p_provider,0)); end if;
  select * into job from public.gateway_outbox where id=p_id and lease_id=p_lease and state='working' for update;
  if job.id is null then return false; end if;
  next_state=case when p_provider is not null then 'accepted' when p_retryable and job.attempts<6 and job.first_attempt_at>now()-interval '23 hours' then 'queued' else 'failed' end;
  update public.gateway_outbox set state=next_state,provider_id=p_provider,last_error_code=p_error,lease_until=null,
    next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,job.attempts))::int)) where id=p_id;
  update public.gateway_tickets set email_status=case when next_state='accepted' then coalesce(public.gateway_delivery_status(p_provider),'provider_accepted') when next_state='failed' then 'failed' else 'queued' end,updated_at=now() where id=job.ticket_id;
  insert into public.gateway_events(ticket_id,kind) values(job.ticket_id,'email_'||next_state);
  return true;
end $$;

-- The API sets the reviewed policy version; do not hard-code future receipts.
create or replace function public.gateway_create_ticket(p_owner uuid,p_key uuid,p_hash text,p_data jsonb,p_mail jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare found public.gateway_tickets; begin
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_key::text,0));
  select * into found from public.gateway_tickets where owner_id=p_owner and idempotency_key=p_key;
  if found.id is not null then
    if found.request_hash<>p_hash then raise exception 'idempotency-conflict'; end if;
    return jsonb_build_object('id',found.id,'status',found.status,'emailStatus',found.email_status);
  end if;
  insert into public.gateway_tickets(owner_id,idempotency_key,request_hash,topic_id,campus,registration_issue,description,student_name,reply_email,lang,consent_version,destination)
  values(p_owner,p_key,p_hash,p_data->>'topicId',p_data->>'campus',p_data->>'registrationIssue',p_data->>'description',p_data->>'name',p_data->>'replyEmail',p_data->>'lang',coalesce(p_data->>'noticeVersion','union-intake-v1'),p_data->'destination') returning * into found;
  insert into public.gateway_outbox(ticket_id,payload) values(found.id,p_mail);
  insert into public.gateway_events(ticket_id,kind) values(found.id,'received');
  return jsonb_build_object('id',found.id,'status',found.status,'emailStatus',found.email_status);
end $$;

create function public.gateway_operations() returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object(
   'schemaVersion',4,
   'queued',(select count(*) from public.gateway_outbox where state in ('queued','working')),
   'oldestPendingSeconds',(select coalesce(extract(epoch from now()-min(created_at)),0)::int from public.gateway_outbox where state in ('queued','working')),
   'needsAttention',(select count(*) from public.gateway_tickets where status<>'resolved' and email_status in ('failed','bounced','complained')),
   'unresolved',(select count(*) from public.gateway_tickets where status<>'resolved'),
   'lastPrunedAt',(select last_pruned_at from public.gateway_maintenance where id)
 );
$$;
create function public.gateway_list_cases() returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(row_to_json(t)),'[]'::jsonb) from
 (select id,topic_id,campus,status,email_status,created_at from public.gateway_tickets where status<>'resolved' order by created_at limit 100) t;
$$;
create function public.gateway_case_status(p_id uuid,p_status text,p_actor text) returns boolean language plpgsql security definer set search_path='' as $$
begin
  if p_status is null or p_actor is null or p_status not in ('received','in_progress','resolved') or length(trim(p_actor)) not between 1 and 100 then raise exception 'invalid-operator-action'; end if;
  update public.gateway_tickets set status=p_status,updated_at=now() where id=p_id;
  if not found then return false; end if;
  insert into public.gateway_events(ticket_id,kind,actor) values(p_id,'case_'||p_status,p_actor);
  return true;
end $$;
create function public.gateway_erase_ticket(p_id uuid) returns boolean language plpgsql security definer set search_path='' as $$
declare job public.gateway_outbox; begin
  select * into job from public.gateway_outbox where ticket_id=p_id for update;
  if job.state='working' and job.lease_until>now() then raise exception 'delivery-in-progress'; end if;
  delete from public.gateway_delivery_events where provider_id=job.provider_id;
  delete from public.gateway_tickets where id=p_id;
  return found;
end $$;
create function public.gateway_prune(p_days int) returns int language plpgsql security definer set search_path='' as $$
declare job record; removed int=0; begin
  if p_days not between 7 and 365 then raise exception 'invalid-retention'; end if;
  -- Cross-replica lock; persist the schedule to avoid destructive work on every restart.
  perform 1 from public.gateway_maintenance where id for update;
  if (select last_pruned_at>now()-interval '1 hour' from public.gateway_maintenance where id) then return 0; end if;
  for job in select o.ticket_id from public.gateway_outbox o join public.gateway_tickets t on t.id=o.ticket_id
    where t.created_at<now()-make_interval(days=>p_days) and not (o.state='working' and o.lease_until>now())
    limit 500 for update of o skip locked loop
    if public.gateway_erase_ticket(job.ticket_id) then removed=removed+1; end if;
  end loop;
  delete from public.gateway_rate_limits where window_start<now()-interval '2 hours';
  delete from public.gateway_delivery_events e where received_at<now()-interval '7 days' and not exists(select 1 from public.gateway_outbox o where o.provider_id=e.provider_id);
  update public.gateway_maintenance set last_pruned_at=now() where id;
  return removed;
end $$;
revoke all on function public.gateway_delivery_status(text),public.gateway_email_event(text,text,text,timestamptz),public.gateway_operations(),public.gateway_list_cases(),public.gateway_case_status(uuid,text,text),public.gateway_erase_ticket(uuid),public.gateway_prune(int) from public,anon,authenticated;
grant execute on function public.gateway_delivery_status(text),public.gateway_email_event(text,text,text,timestamptz),public.gateway_operations(),public.gateway_list_cases(),public.gateway_case_status(uuid,text,text),public.gateway_erase_ticket(uuid),public.gateway_prune(int) to service_role;
commit;
