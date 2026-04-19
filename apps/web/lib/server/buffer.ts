import "server-only";
import { pushLoki } from "./sinks/loki";
import { insertClickhouse } from "./sinks/clickhouse";
import type { TxLogEnriched } from "./schema";

const MAX_BATCH = 5000;
const FLUSH_MS = 1000;
const MAX_QUEUE = 50_000;

declare global {
  var __lwState: {
    queue: TxLogEnriched[];
    flushing: boolean;
    timer?: NodeJS.Timeout;
    metrics: {
      ingested: number;
      flushed: number;
      loki_errors: number;
      ch_errors: number;
      dropped: number;
    };
  } | undefined;
}

const state = (global.__lwState ??= {
  queue: [],
  flushing: false,
  metrics: { ingested: 0, flushed: 0, loki_errors: 0, ch_errors: 0, dropped: 0 },
});

export const metrics = {
  get ingested() { return state.metrics.ingested; },
  get flushed()  { return state.metrics.flushed; },
  get loki_errors() { return state.metrics.loki_errors; },
  get ch_errors()   { return state.metrics.ch_errors; },
  get dropped()  { return state.metrics.dropped; },
  get queued()   { return state.queue.length; },
};

export function enqueue(l: TxLogEnriched): void {
  if (state.queue.length >= MAX_QUEUE) { state.metrics.dropped++; return; }
  state.queue.push(l);
  state.metrics.ingested++;
  if (state.queue.length >= MAX_BATCH) void flush();
}

export async function flush(): Promise<void> {
  if (state.flushing || !state.queue.length) return;
  state.flushing = true;
  const batch = state.queue;
  state.queue = [];
  try {
    const [lokiR, chR] = await Promise.allSettled([pushLoki(batch), insertClickhouse(batch)]);
    if (lokiR.status === "rejected") state.metrics.loki_errors++;
    if (chR.status === "rejected") state.metrics.ch_errors++;
    state.metrics.flushed += batch.length;
  } finally { state.flushing = false; }
}

export function ensureFlusher(): void {
  if (state.timer) return;
  state.timer = setInterval(() => void flush(), FLUSH_MS);
  state.timer.unref?.();
}
