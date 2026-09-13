import { setTimeout as delay } from 'node:timers/promises';
import { deliverOne } from './mail.mjs';
export function startBackground(
  store,
  config,
  { deliver = deliverOne, log = console.log, wait = delay, now = Date.now } = {},
) {
  const controller = new AbortController();
  const state = { lastSuccess: 0, stopping: false, metrics: null };
  let maintenanceAt = 0,
    lastAlert = '';
  const done = (async () => {
    while (!state.stopping) {
      let pause = 1500;
      try {
        if (now() >= maintenanceAt) {
          const metrics = await store.rpc('gateway_operations', {});
          if (metrics?.schemaVersion !== 4) throw new Error('Schema not ready');
          await store.rpc('gateway_prune', { p_days: config.service.retentionDays });
          state.metrics = metrics;
          maintenanceAt = now() + 60000;
          const alert = metrics.needsAttention > 0 || metrics.oldestPendingSeconds > 300;
          const signature = `${alert}:${metrics.needsAttention}`;
          if (signature !== lastAlert) {
            log(
              JSON.stringify({
                event: alert ? 'operator_attention' : 'queue_healthy',
                queued: metrics.queued,
                needsAttention: metrics.needsAttention,
                oldestPendingSeconds: metrics.oldestPendingSeconds,
              }),
            );
            lastAlert = signature;
          }
        }
        if (state.stopping) break;
        if (await deliver(store, config)) pause = 25;
        state.lastSuccess = now();
      } catch {
        // Never log keys, email addresses, descriptions, upstream payloads or cookies.
        log(JSON.stringify({ event: 'background_dependency_failure' }));
        pause = 5000;
      }
      if (!state.stopping)
        await wait(pause, undefined, { signal: controller.signal }).catch(() => {});
    }
  })();
  return {
    state,
    done,
    stop() {
      state.stopping = true;
      controller.abort();
      return done;
    },
  };
}
