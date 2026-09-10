-- Apply to a dedicated Supabase project as an administrative database user.
-- Tables and RPCs are service-role only. End-user ownership is enforced in RPCs
-- using the authenticated user ID obtained by the server from Supabase Auth.
begin;
create table public.gateway_tickets (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null,
  idempotency_key uuid not null, request_hash text not null,
  topic_id text not null, campus text not null, registration_issue text not null default '',
  description text not null check(length(description) between 1 and 3000),
  student_name text not null default '', reply_email text not null,
  lang text not null check(lang in ('he','en')), consent_version text not null,
  destination jsonb not null, status text not null default 'received' check(status in ('received','in_progress','resolved')),
  email_status text not null default 'queued' check(email_status in ('queued','provider_accepted','failed')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(owner_id,idempotency_key)
);
create index gateway_tickets_owner on public.gateway_tickets(owner_id,created_at desc);
create table public.gateway_outbox (
  id uuid primary key default gen_random_uuid(), ticket_id uuid not null unique references public.gateway_tickets(id) on delete cascade,
  payload jsonb not null, state text not null default 'queued' check(state in ('queued','working','accepted','failed')),
  attempts int not null default 0, next_attempt_at timestamptz not null default now(),
  lease_id uuid, lease_until timestamptz, provider_id text, first_attempt_at timestamptz,
  last_error_code text, created_at timestamptz not null default now()
);
create index gateway_outbox_pending on public.gateway_outbox(next_attempt_at) where state in ('queued','working');
create table public.gateway_events (
  id bigint generated always as identity primary key, ticket_id uuid not null references public.gateway_tickets(id) on delete cascade,
  kind text not null, created_at timestamptz not null default now()
);
create table public.gateway_rate_limits (
  bucket text primary key, window_start timestamptz not null default now(), hits int not null default 1
);
alter table public.gateway_tickets enable row level security;
alter table public.gateway_outbox enable row level security;
alter table public.gateway_events enable row level security;
alter table public.gateway_rate_limits enable row level security;
revoke all on public.gateway_tickets, public.gateway_outbox, public.gateway_events, public.gateway_rate_limits from public,anon,authenticated;
grant all on public.gateway_tickets, public.gateway_outbox, public.gateway_events, public.gateway_rate_limits to service_role;
grant usage,select on sequence public.gateway_events_id_seq to service_role;

create function public.gateway_create_ticket(p_owner uuid,p_key uuid,p_hash text,p_data jsonb,p_mail jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare found public.gateway_tickets; begin
  -- Serialize retries of this logical request, including across API instances.
  perform pg_advisory_xact_lock(hashtextextended(p_owner::text||p_key::text,0));
  select * into found from public.gateway_tickets where owner_id=p_owner and idempotency_key=p_key;
  if found.id is not null then
    if found.request_hash<>p_hash then raise exception 'idempotency-conflict'; end if;
    return jsonb_build_object('id',found.id,'status',found.status,'emailStatus',found.email_status);
  end if;
  insert into public.gateway_tickets(owner_id,idempotency_key,request_hash,topic_id,campus,registration_issue,description,student_name,reply_email,lang,consent_version,destination)
  values(p_owner,p_key,p_hash,p_data->>'topicId',p_data->>'campus',p_data->>'registrationIssue',p_data->>'description',p_data->>'name',p_data->>'replyEmail',p_data->>'lang','union-intake-v1',p_data->'destination') returning * into found;
  insert into public.gateway_outbox(ticket_id,payload) values(found.id,p_mail);
  insert into public.gateway_events(ticket_id,kind) values(found.id,'received');
  return jsonb_build_object('id',found.id,'status',found.status,'emailStatus',found.email_status);
end $$;

create function public.gateway_get_ticket(p_id uuid,p_owner uuid)
returns jsonb language sql security definer set search_path='' as $$
select jsonb_build_object('id',id,'status',status,'emailStatus',email_status,'topicId',topic_id,'createdAt',created_at,'recipient',destination->'name')
from public.gateway_tickets where id=p_id and owner_id=p_owner;
$$;

create function public.gateway_rate_limit(p_bucket text,p_limit int,p_seconds int)
returns boolean language plpgsql security definer set search_path='' as $$
declare result public.gateway_rate_limits; begin
  if p_limit<1 or p_seconds<1 then return false; end if;
  insert into public.gateway_rate_limits(bucket) values(p_bucket)
  on conflict(bucket) do update set
    hits=case when gateway_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else gateway_rate_limits.hits+1 end,
    window_start=case when gateway_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else gateway_rate_limits.window_start end
  returning * into result;
  return result.hits<=p_limit;
end $$;

create function public.gateway_claim_email()
returns jsonb language plpgsql security definer set search_path='' as $$
declare job public.gateway_outbox; begin
  -- Never retry beyond the provider's idempotency horizon after an uncertain send.
  with expired as (
    update public.gateway_outbox set state='failed',last_error_code='retry-window-expired'
    where state in ('queued','working') and (first_attempt_at<now()-interval '23 hours' or attempts>=6)
      and (lease_until is null or lease_until<now()) returning ticket_id
  ) update public.gateway_tickets set email_status='failed',updated_at=now() where id in (select ticket_id from expired);
  select * into job from public.gateway_outbox
  where ((state='queued' and next_attempt_at<=now()) or (state='working' and lease_until<now()))
    and attempts<6 and (first_attempt_at is null or first_attempt_at>now()-interval '23 hours')
  order by created_at for update skip locked limit 1;
  if job.id is null then return null; end if;
  update public.gateway_outbox set state='working',attempts=attempts+1,lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',first_attempt_at=coalesce(first_attempt_at,now())
    where id=job.id returning * into job;
  return to_jsonb(job);
end $$;

create function public.gateway_finish_email(p_id uuid,p_lease uuid,p_provider text,p_error text,p_retryable boolean)
returns boolean language plpgsql security definer set search_path='' as $$
declare job public.gateway_outbox; next_state text; begin
  select * into job from public.gateway_outbox where id=p_id and lease_id=p_lease and state='working' for update;
  if job.id is null then return false; end if;
  next_state=case when p_provider is not null then 'accepted' when p_retryable and job.attempts<6 and job.first_attempt_at>now()-interval '23 hours' then 'queued' else 'failed' end;
  update public.gateway_outbox set state=next_state,provider_id=p_provider,last_error_code=p_error,lease_until=null,
    next_attempt_at=now()+make_interval(secs=>least(3600,(30*power(2,job.attempts))::int)) where id=p_id;
  update public.gateway_tickets set email_status=case when next_state='accepted' then 'provider_accepted' when next_state='failed' then 'failed' else 'queued' end,updated_at=now() where id=job.ticket_id;
  insert into public.gateway_events(ticket_id,kind) values(job.ticket_id,'email_'||next_state);
  return true;
end $$;

revoke all on function public.gateway_create_ticket(uuid,uuid,text,jsonb,jsonb),public.gateway_get_ticket(uuid,uuid),public.gateway_rate_limit(text,int,int),public.gateway_claim_email(),public.gateway_finish_email(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.gateway_create_ticket(uuid,uuid,text,jsonb,jsonb),public.gateway_get_ticket(uuid,uuid),public.gateway_rate_limit(text,int,int),public.gateway_claim_email(),public.gateway_finish_email(uuid,uuid,text,text,boolean) to service_role;
commit;
