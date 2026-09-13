\set ON_ERROR_STOP on
begin;
do $$
declare t jsonb; j jsonb; who uuid='00000000-0000-4000-8000-000000000001';
d jsonb='{"topicId":"housing","campus":"givat-ram","registrationIssue":"","description":"Synthetic test","name":"Test","replyEmail":"test@example.org","lang":"en","noticeVersion":"notice-v2","destination":{}}';
begin
 t=public.gateway_create_ticket(who,gen_random_uuid(),'hash',d,'{"text":"synthetic"}');
 assert (select consent_version='notice-v2' from public.gateway_tickets where id=(t->>'id')::uuid),'reviewed consent version';
 j=public.gateway_claim_email();
 -- A delivery callback can precede provider acknowledgement.
 assert public.gateway_email_event('test-delivered','provider-before-ack','delivered',now()),'first callback';
 assert not public.gateway_email_event('test-delivered','provider-before-ack','delivered',now()),'callback replay ignored';
 perform public.gateway_finish_email((j->>'id')::uuid,(j->>'lease_id')::uuid,'provider-before-ack',null,false);
 assert (public.gateway_get_ticket((t->>'id')::uuid,who)->>'emailStatus')='delivered','early callback reconciled';
 perform public.gateway_email_event('test-delayed','provider-before-ack','delayed',now()-interval '1 minute');
 assert (public.gateway_get_ticket((t->>'id')::uuid,who)->>'emailStatus')='delivered','late delay cannot undo delivery';
 perform public.gateway_email_event('test-bounced','provider-before-ack','bounced',now());
 perform public.gateway_email_event('test-old-delivered','provider-before-ack','delivered',now()-interval '2 minutes');
 assert (public.gateway_get_ticket((t->>'id')::uuid,who)->>'emailStatus')='bounced','late delivery cannot hide terminal failure';
 assert public.gateway_case_status((t->>'id')::uuid,'resolved','test-operator'),'case update';
 assert exists(select 1 from public.gateway_events where actor='test-operator'),'attributed status event';
 assert not has_function_privilege('authenticated','public.gateway_erase_ticket(uuid)','execute'),'students cannot erase arbitrary records';
 assert not has_function_privilege('anon','public.gateway_operations()','execute'),'operations are private';
 assert not has_table_privilege('anon','public.gateway_delivery_events','select'),'delivery metadata private';
 update public.gateway_tickets set created_at=now()-interval '91 days' where id=(t->>'id')::uuid;
 assert public.gateway_prune(90)=1,'expired ticket deleted';
 assert not exists(select 1 from public.gateway_outbox where ticket_id=(t->>'id')::uuid),'outbox payload deleted';
 assert not exists(select 1 from public.gateway_events where ticket_id=(t->>'id')::uuid),'case events deleted';
 assert not exists(select 1 from public.gateway_delivery_events where provider_id='provider-before-ack'),'delivery records deleted';
 t=public.gateway_create_ticket(who,gen_random_uuid(),'hash2',d,'{"text":"synthetic"}');
 j=public.gateway_claim_email();
 begin
  perform public.gateway_erase_ticket((t->>'id')::uuid);
  raise exception 'erase should refuse active send';
 exception when others then if sqlerrm<>'delivery-in-progress' then raise; end if; end;
 update public.gateway_tickets set created_at=now()-interval '91 days' where id=(t->>'id')::uuid;
 update public.gateway_maintenance set last_pruned_at=null;
 assert public.gateway_prune(90)=0,'active sends survive retention pass';
 update public.gateway_outbox set lease_until=now()-interval '1 second' where ticket_id=(t->>'id')::uuid;
 assert public.gateway_erase_ticket((t->>'id')::uuid),'expired lease can be deleted';
 assert (public.gateway_operations()->>'schemaVersion')::int=4,'schema readiness';
end $$;
rollback;
