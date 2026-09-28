export type DomainErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "invalid"
  | "expired"
  | "locked"
  | "conflict"
  | "sold_out"
  | "demo_only";

/** A rule said no. Callers map the code to a status or a friendly message. */
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export function isDomainError(error: unknown, code?: DomainErrorCode): error is DomainError {
  return error instanceof DomainError && (code === undefined || error.code === code);
}
