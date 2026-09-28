import { ImageResponse } from "next/og";
import { connection } from "next/server";
import { logoDataUrl, ogFonts } from "@/lib/brand/assets";
import { tokens } from "@/lib/brand/tokens";
import { dateBlock, formatTime, zoneLabel } from "@/lib/dates";
import { getDb } from "@/lib/db";
import { ANONYMOUS } from "@/lib/domain/actor";
import { isDomainError } from "@/lib/domain/errors";
import { getPublicNight } from "@/lib/domain/events";

export const alt = "An Underdogs night";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Share images are fetched by crawlers with no cookies, so the viewer is always anonymous.
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  await connection();
  const { slug } = await params;
  const db = await getDb();
  let night;
  try {
    night = await getPublicNight(db, ANONYMOUS, { slug });
  } catch (error) {
    if (isDomainError(error, "not_found")) return new Response("Not found", { status: 404 });
    throw error;
  }

  const [c, logo, fonts] = await Promise.all([
    tokens(["--ic-onyx", "--ic-void", "--ic-gold-700", "--ic-gold-500", "--ic-gold-300", "--ic-ivory", "--ic-ivory-dim"]),
    logoDataUrl(),
    ogFonts(),
  ]);
  const block = dateBlock(night.startsAt, night.timezone);
  const when = night.timeTbc
    ? `${block.weekday} ${block.day} ${block.month} ${block.year}`
    : `${block.weekday} ${block.day} ${block.month} ${block.year} · ${formatTime(night.startsAt, night.timezone)} ${zoneLabel(night.timezone)}`;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: c["--ic-onyx"], padding: 28 }}>
        {/* the double rule */}
        <div style={{ flex: 1, display: "flex", border: `1px solid ${c["--ic-gold-700"]}`, padding: 7 }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 56,
              padding: "0 56px",
              border: `1px solid ${c["--ic-gold-700"]}`,
              background: c["--ic-void"],
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain img */}
            <img src={logo} width={400} height={400} alt="" style={{ borderRadius: 400 }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>
              <div style={{ fontFamily: "Cinzel", fontSize: 24, letterSpacing: 6, color: c["--ic-gold-500"] }}>
                UNDERDOGS · NAGPUR
              </div>
              <div style={{ fontFamily: "EB Garamond", fontSize: 64, lineHeight: 1.05, color: c["--ic-ivory"] }}>
                {night.title}
              </div>
              <div style={{ fontFamily: "Cinzel", fontSize: 30, letterSpacing: 2, color: c["--ic-gold-300"] }}>{when}</div>
              <div style={{ fontFamily: "EB Garamond", fontSize: 30, color: c["--ic-ivory-dim"] }}>
                {night.venue ? `${night.venue.name}, ${night.venue.city}` : "Venue to be announced"}
              </div>
              {night.isDemo ? (
                <div style={{ display: "flex", marginTop: 8 }}>
                  <div
                    style={{
                      fontFamily: "Cinzel",
                      fontSize: 20,
                      letterSpacing: 4,
                      color: c["--ic-gold-500"],
                      border: `1px solid ${c["--ic-gold-700"]}`,
                      borderRadius: 999,
                      padding: "6px 18px",
                    }}
                  >
                    DEMO
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
