import { ImageResponse } from "next/og";
import { logoDataUrl } from "@/lib/brand/assets";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: the full Logo.jpg (the coin on studio black). */
export default async function AppleIcon() {
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain img */}
        <img src={logo} alt="" width={180} height={180} />
      </div>
    ),
    size,
  );
}
