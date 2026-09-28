import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

/** URL-safe random token, e.g. the 32-byte coin link. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacHex(key: string | Uint8Array, input: string): string {
  return createHmac("sha256", key).update(input).digest("hex");
}

/** Constant-time string comparison (length leaks, content does not). */
export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** A zero-padded numeric code, e.g. a 6-digit OTP. */
export function numericCode(digits: number): string {
  return String(randomInt(0, 10 ** digits)).padStart(digits, "0");
}
