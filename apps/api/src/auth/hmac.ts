import crypto from "node:crypto";
import { SERVER_SECRETS } from "../env.js";

/**
 * Verify HMAC-SHA256 of the raw request body using a per-server secret.
 * Header format: X-Signature: <hex>
 */
export function verifyHmac(serverId: string, raw: Buffer | string, sig: string): boolean {
  const secret = SERVER_SECRETS[serverId];
  if (!secret || !sig) return false;
  const buf = typeof raw === "string" ? Buffer.from(raw) : raw;
  const mac = crypto.createHmac("sha256", secret).update(buf).digest("hex");
  const a = Buffer.from(mac, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(sig, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
