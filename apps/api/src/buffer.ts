import { pushLoki } from "./sinks/loki.js";
import { insertClickhouse } from "./sinks/clickhouse.js";
import type { TxLogEnriched } from "./schema.js";

const MAX_BATCH = 5000;
const FLUSH_MS = 1000;
const MAX_QUEUE = 50_000;

let queue: TxLogEnriched[] = [];
let dropped = 0;

export const metrics = {
  ingested: 0,
  flushed: 0,
  loki_errors: 0,
  ch_errors: 0,
  get queued() {
    return queue.length;
  },
  get dropped() {
    return dropped;
  },
};

export function enqueue(l: TxLogEnriched): void {
  if (queue.length >= MAX_QUEUE) {
    dropped++;
    return;
  }
  queue.push(l);
  metrics.ingested++;
  if (queue.length >= MAX_BATCH) void flush();
}

let flushing = false;
export async function flush(): Promise<void> {
  if (flushing || !queue.length) return;
  flushing = true;
  const batch = queue;
  queue = [];
  try {
    const [lokiR, chR] = await Promise.allSettled([pushLoki(batch), insertClickhouse(batch)]);
    if (lokiR.status === "rejected") metrics.loki_errors++;
    if (chR.status === "rejected") metrics.ch_errors++;
    metrics.flushed += batch.length;
  } finally {
    flushing = false;
  }
}

export function startFlusher(): NodeJS.Timeout {
  const t = setInterval(() => void flush(), FLUSH_MS);
  t.unref();
  return t;
}
