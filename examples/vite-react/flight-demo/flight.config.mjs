// Flight's options, built from the environment. The server passes them to flight.start(), and
// `reins flight watch --config flight.config.mjs` and `reins flight report --config flight.config.mjs` load the
// same module, so the store and the sinks are defined once. Addresses and secrets come from the environment,
// never from reins.flight.json.
import { fileSink, fileStore, webhookSink } from '@mindmakr/reins/flight';

const dir = process.env.FLIGHT_DIR || '.reins/flight';
const url = process.env.FLIGHT_WEBHOOK_URL;
const secret = process.env.FLIGHT_WEBHOOK_SECRET;

export default {
  // The server and the watcher share this folder (a Docker volume), so the file store is enough: one machine.
  store: fileStore({ dir }),
  sinks: [...(url && secret ? [webhookSink({ url, secret })] : []), fileSink({ dir })],
  // Read by `reins flight watch` only: it polls this address and reports when the server stops answering.
  healthUrl: process.env.FLIGHT_HEALTH_URL,
  // The demo checks every 2 s so it finishes in about a minute; the default is 60 s.
  checkEveryMs: Number(process.env.FLIGHT_CHECK_EVERY_MS || 60_000),
  instance: process.env.FLIGHT_INSTANCE || undefined,
  // No daily summary in the demo, so the receiver shows only the findings.
  notify: { daily: false },
};
