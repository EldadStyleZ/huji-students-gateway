import { loadConfig } from './src/config.mjs';
import { createSupabase } from './src/supabase.mjs';
import { startBackground } from './src/background.mjs';
const config = await loadConfig();
if (!config.live) throw new Error('Worker requires live mode');
const background = startBackground(createSupabase(config), config);
process.on('SIGTERM', () => background.stop());
process.on('SIGINT', () => background.stop());
await background.done;
