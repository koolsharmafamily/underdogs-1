import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getActor } from "@/lib/auth/request";
import { getDb } from "@/lib/db";
import { isDomainError } from "@/lib/domain/errors";
import { getCoinByToken } from "@/lib/domain/innercircle";
import { CoinMintClient } from "./CoinMintClient";

export const metadata: Metadata = {
  title: "Claim Your Coin",
  robots: { index: false, follow: false },
};

export default async function CoinClaimPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const actor = await getActor(db);

  let coin;
  try {
    coin = await getCoinByToken(db, actor, { token });
  } catch (e) {
    if (isDomainError(e, "not_found")) notFound();
    throw e;
  }

  const clientActor = actor.kind === "guest" ? actor : ({ kind: "anonymous" } as const);

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-12 sm:px-6 sm:py-16">
      <CoinMintClient token={token} coin={coin} actor={clientActor} />
    </div>
  );
}
