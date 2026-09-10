begin;
create function public.gateway_email_reference()
returns trigger language plpgsql set search_path='' as $$
begin
  if new.payload is not null then
    new.payload=new.payload||jsonb_build_object(
      'subject',coalesce(new.payload->>'subject','Student support request')||' ['||new.ticket_id::text||']',
      'text',coalesce(new.payload->>'text','')||E'\n\nRequest reference: '||new.ticket_id::text
    );
  end if;
  return new;
end $$;
create trigger gateway_email_reference before insert on public.gateway_outbox
for each row execute function public.gateway_email_reference();
revoke all on function public.gateway_email_reference() from public,anon,authenticated;
commit;
