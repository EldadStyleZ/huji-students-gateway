\set ON_ERROR_STOP on
begin;
do $$
declare ticket jsonb; replay jsonb; job jsonb; job2 jsonb; who uuid='00000000-0000-4000-8000-000000000001'; key uuid='00000000-0000-4000-8000-000000000002';
data jsonb='{"topicId":"housing","campus":"givat-ram","registrationIssue":"","description":"Synthetic test","name":"Test","replyEmail":"test@example.org","lang":"en","destination":{"name":{"en":"Test team"}}}';
begin
ticket=public.gateway_create_ticket(who,key,'hash',data,'{"text":"Synthetic message"}');
replay=public.gateway_create_ticket(who,key,'hash',data,'{"text":"Changed payload must not create another email"}');
assert ticket->>'id'=replay->>'id','idempotent receipt';
assert (select count(*) from public.gateway_outbox where ticket_id=(ticket->>'id')::uuid)=1,'one email';
assert (select position(ticket->>'id' in payload->>'text')>0 from public.gateway_outbox where ticket_id=(ticket->>'id')::uuid),'frozen email includes receipt reference';
assert public.gateway_get_ticket((ticket->>'id')::uuid,'00000000-0000-4000-8000-000000000099') is null,'cross-student access denied';
begin
perform public.gateway_create_ticket(who,key,'different-hash',data,'{}');
raise exception 'expected conflict';
exception when others then if sqlerrm<>'idempotency-conflict' then raise;end if;end;
begin
perform public.gateway_create_ticket(who,'00000000-0000-4000-8000-000000000003','hash',data,null);
raise exception 'expected outbox failure';
exception when not_null_violation then null;end;
assert not exists(select 1 from public.gateway_tickets where idempotency_key='00000000-0000-4000-8000-000000000003'),'ticket rolled back with failed outbox';
job=public.gateway_claim_email();assert job is not null,'claim available';
assert public.gateway_claim_email() is null,'no duplicate concurrent claim';
update public.gateway_outbox set lease_until=now()-interval '1 second' where id=(job->>'id')::uuid;
job2=public.gateway_claim_email();assert job2->>'id'=job->>'id','crashed job recovered';
assert job2->>'lease_id'<>job->>'lease_id','lease fencing';
assert not public.gateway_finish_email((job->>'id')::uuid,(job->>'lease_id')::uuid,'old-provider',null,false),'stale worker cannot acknowledge';
assert public.gateway_finish_email((job2->>'id')::uuid,(job2->>'lease_id')::uuid,'provider-1',null,false),'current worker acknowledges';
assert (public.gateway_get_ticket((ticket->>'id')::uuid,who)->>'emailStatus')='provider_accepted','precise email status';
assert not has_table_privilege('anon','public.gateway_tickets','select'),'anon cannot read';
assert not has_table_privilege('authenticated','public.gateway_tickets','select'),'authenticated cannot bypass API';
assert not has_function_privilege('authenticated','public.gateway_create_ticket(uuid,uuid,text,jsonb,jsonb)','execute'),'no public admin RPC';
assert public.gateway_rate_limit('test-bucket',1,60),'first request allowed';
assert not public.gateway_rate_limit('test-bucket',1,60),'second request limited';
end $$;
rollback;
