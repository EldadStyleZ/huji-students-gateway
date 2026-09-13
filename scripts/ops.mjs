import { createSupabase } from '../src/supabase.mjs';
const [command, id, value, ...extra] = process.argv.slice(2);
const config = {
  supabaseUrl: process.env.SUPABASE_URL,
  serviceKey: process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
};
const usage =
  'Use: npm run ops -- status | cases | set-status UUID received|in_progress|resolved | erase UUID --confirm-ticket=UUID. Set OPERATOR_NAME for status changes.';
try {
  if (
    !config.supabaseUrl ||
    new URL(config.supabaseUrl).protocol !== 'https:' ||
    !config.serviceKey
  )
    throw new Error(
      'Set SUPABASE_URL and SUPABASE_SECRET_KEY in an ignored .env or server environment.',
    );
  const store = createSupabase(config);
  let result;
  if (['status', 'cases'].includes(command) && !id)
    result = await store.rpc(
      command === 'status' ? 'gateway_operations' : 'gateway_list_cases',
      {},
    );
  else if (
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '') &&
    !extra.length
  ) {
    if (
      command === 'set-status' &&
      ['received', 'in_progress', 'resolved'].includes(value) &&
      process.env.OPERATOR_NAME?.trim()
    )
      result = await store.rpc('gateway_case_status', {
        p_id: id,
        p_status: value,
        p_actor: process.env.OPERATOR_NAME.trim(),
      });
    else if (command === 'erase' && value === `--confirm-ticket=${id}`)
      result = await store.rpc('gateway_erase_ticket', { p_id: id });
    else throw new Error(usage);
  } else throw new Error(usage);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
