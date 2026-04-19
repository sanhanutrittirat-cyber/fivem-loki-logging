import "server-only";
import crypto from "node:crypto";
import { SERVER_SECRETS } from "../env";

export function verifyHmac(serverId: string, raw: Buffer | string, sig: string): boolean {
  const secret = SERVER_SECRETS[serverId];
  if (!secret || !sig) return false;
  const buf = typeof raw === "string" ? Buffer.from(raw) : raw;
  const mac = crypto.createHmac("sha256", secret).update(buf).digest("hex");
  let a: Buffer, b: Buffer;
  try { a = Buffer.from(mac, "hex"); b = Buffer.from(sig, "hex"); } catch { return false; }
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
