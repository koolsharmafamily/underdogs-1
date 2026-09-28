/*
  Who is asking, and what they may do. Every domain function receives an Actor
  and checks it here; nothing upstream is trusted to have checked.
*/
import { DomainError } from "./errors";

export type Role = "guest" | "crew" | "admin";

export type GuestActor = {
  kind: "guest";
  guestId: string;
  role: Role;
  name: string | null;
  phone: string;
};

export type Actor =
  | { kind: "anonymous" }
  | GuestActor
  /** Cron, the lazy tick and the seed: trusted internal callers with no person behind them. */
  | { kind: "system"; reason: string };

export const ANONYMOUS: Actor = { kind: "anonymous" };
export const system = (reason: string): Actor => ({ kind: "system", reason });

export type Capability =
  | "review_requests" // approve, waitlist, decline, confirm RSVP
  | "issue_coins" // direct invites
  | "manage_nights" // nights, venues, FAQ, copy
  | "read_outbox"
  | "see_venues"; // every venue, whatever the drop time

const GRANTS: Record<Capability, readonly Role[]> = {
  review_requests: ["crew", "admin"],
  issue_coins: ["crew", "admin"],
  manage_nights: ["crew", "admin"],
  read_outbox: ["crew", "admin"],
  see_venues: ["crew", "admin"],
};

export function can(actor: Actor, capability: Capability): boolean {
  if (actor.kind === "system") return true;
  if (actor.kind !== "guest") return false;
  return GRANTS[capability].includes(actor.role);
}

export function assertCan(actor: Actor, capability: Capability): void {
  if (actor.kind === "anonymous") throw new DomainError("unauthenticated", "Sign in first.");
  if (!can(actor, capability)) throw new DomainError("forbidden", "Not for this account.");
}

export function assertSignedIn(actor: Actor): asserts actor is GuestActor {
  if (actor.kind !== "guest") throw new DomainError("unauthenticated", "Sign in first.");
}

export function isCrew(actor: Actor): boolean {
  return actor.kind === "guest" && (actor.role === "crew" || actor.role === "admin");
}
