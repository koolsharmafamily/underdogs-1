import { ImageResponse } from "next/og";
import { logoDataUrl } from "@/lib/brand/assets";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/** The favicon is the coin itself, cropped from Logo.jpg. */
export default async function Icon() {
  const logo = await logoDataUrl();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse needs a plain img */}
        <img src={logo} alt="" style={{ width: "124%", height: "124%", margin: "-12%", borderRadius: 999 }} />
      </div>
    ),
    size,
  );
}
