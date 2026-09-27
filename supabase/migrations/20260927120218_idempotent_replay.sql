begin;
create function public.gateway_replay_ticket(p_owner uuid,p_key uuid,p_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare found public.gateway_tickets; begin
select * into found from public.gateway_tickets where owner_id=p_owner and idempotency_key=p_key;
if found.id is null then return null; end if;
if found.request_hash<>p_hash then raise exception 'idempotency-conflict'; end if;
return jsonb_build_object('id',found.id,'status',found.status,'emailStatus',found.email_status);
end $$;
revoke all on function public.gateway_replay_ticket(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.gateway_replay_ticket(uuid,uuid,text) to service_role;
commit;
