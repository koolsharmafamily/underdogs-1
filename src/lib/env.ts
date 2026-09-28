/*
  Server-side environment. Everything is optional in demo mode.
  Read through functions (not constants) so tests can change process.env.
  No secret here ever gets a NEXT_PUBLIC_ prefix.
*/

/** Demo mode: on by default for this demo deployment, off only when DEMO_MODE=false. */
export function isDemoMode(): boolean {
  const flag = process.env.DEMO_MODE?.trim().toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return true;
}

export function databaseUrl(): string | undefined {
  return process.env.DATABASE_URL?.trim() || undefined;
}

/** True on Vercel (or any read-only serverless host) where .data/ cannot be written. */
export function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function appUrl(): URL {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return new URL(explicit);
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  if (vercel) return new URL(`https://${vercel}`);
  return new URL(`http://localhost:${process.env.PORT || 3000}`);
}
