import { loadConfig } from './src/config.mjs';
import { createSupabase } from './src/supabase.mjs';
import { createGatewayServer } from './src/server.mjs';
import { startBackground } from './src/background.mjs';
const config = await loadConfig();
const store = config.live ? createSupabase(config) : null;
const background = config.live && config.backgroundEnabled ? startBackground(store, config) : null;
const server = await createGatewayServer(config, store, { background });
server.listen(config.port, config.host, () =>
  console.log(`Student gateway (${config.live ? 'live' : 'demo'}): ${config.origin}`),
);
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  const deadline = setTimeout(() => process.exit(1), 30000);
  deadline.unref();
  const drained = new Promise((resolve) => server.close(resolve));
  // Complete an in-flight provider send/ack before exit. Leases recover forced stops.
  await Promise.all([drained, background?.stop()]);
  clearTimeout(deadline);
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
