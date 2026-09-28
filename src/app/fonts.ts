import { Cinzel, EB_Garamond, Inter, Monoton } from "next/font/google";

/** Display caps and dates. */
export const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-cinzel", display: "swap" });

/** Headings and the "Underdogs Innercircle" wordmark line. */
export const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-garamond",
  style: ["normal", "italic"],
  display: "swap",
});

/** UI, forms and chat. */
export const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

/** The Aegean night's title face (80s chrome). Only fetched when an Aegean title is on screen. */
export const monoton = Monoton({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-monoton",
  display: "swap",
  preload: false,
});

export const fontVariables = [cinzel.variable, garamond.variable, inter.variable, monoton.variable].join(" ");
