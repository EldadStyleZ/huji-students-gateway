import { setTimeout } from 'node:timers/promises';
import { loadConfig } from './src/config.mjs';
import { createSupabase } from './src/supabase.mjs';
import { deliverOne } from './src/mail.mjs';
const config = await loadConfig();
if (!config.live) throw new Error('Worker requires live mode');
const store = createSupabase(config);
let stopping = false;
process.on('SIGTERM', () => {
  stopping = true;
});
process.on('SIGINT', () => {
  stopping = true;
});
console.log('Email worker started');
while (!stopping) {
  try {
    const worked = await deliverOne(store, config);
    if (!worked) await setTimeout(3000);
  } catch {
    console.error('Email worker dependency failure; retrying');
    await setTimeout(5000);
  }
}
