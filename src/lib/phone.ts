/*
  Indian mobile numbers only for now (the circle is in Nagpur).
  Accepts "98765 43210", "098765 43210", "+91 98765-43210", "919876543210".
*/
export function normalisePhone(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/** "+91 98765 43210" */
export function formatPhone(e164: string): string {
  const m = /^\+91(\d{5})(\d{5})$/.exec(e164);
  return m ? `+91 ${m[1]} ${m[2]}` : e164;
}

/** "+91 ••••• •3210" for places that should not show the full number. */
export function maskPhone(e164: string): string {
  return `+91 ••••• •${e164.slice(-4)}`;
}
