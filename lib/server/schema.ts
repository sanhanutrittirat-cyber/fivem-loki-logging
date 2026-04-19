import { z } from "zod";

export const TxLog = z
  .object({
    identifier: z.string().min(3).max(128)
      .regex(/^(steam|license|fivem|discord|ip|live):[A-Za-z0-9]+$/i),
    name: z.string().min(1).max(64),
    amount: z.number().finite(),
    resource: z.string().min(1).max(64),
    type: z.enum(["add", "remove"]),
    ts: z.number().int().positive().optional(),
    server_id: z.string().min(1).max(64).optional(),
    char_id: z.string().max(64).optional(),
    reason: z.string().max(256).optional(),
  })
  .strict();

export const TxBatch = z.object({ logs: z.array(TxLog).min(1).max(1000) });

export type TxLogT = z.infer<typeof TxLog>;
export type TxLogEnriched = TxLogT & { ts: number; server_id: string };
