// Screenshots of the home chapters at phone and laptop widths, using the
// installed Chrome (no browser download). Usage:
//   node scripts/shots.mjs <baseUrl> <outDir> [tier] [theme]
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const [base = "http://localhost:3000", out = "shots", tier = "auto", theme = ""] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
for (const [name, viewport] of [["390", { width: 390, height: 844 }], ["1440", { width: 1440, height: 900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: name === "390", hasTouch: name === "390" });
  if (theme) await ctx.addCookies([{ name: "ic_theme", value: theme, url: base }]);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.error("pageerror", e.message));
  await page.goto(`${base}/?tier=${tier}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  const tops = await page.$$eval("[data-chapter]", (els) => els.map((e) => [e.offsetTop, e.offsetHeight]));
  const stops = [
    ["1-vault", 0],
    ["2-heads", tops[1][0] + tops[1][1] * 0.2],
    ["2-tails", tops[1][0] + tops[1][1] * 0.62],
    ["3-drop", tops[2][0] - 60],
    ["4-circle", tops[3][0] + tops[3][1] * 0.5],
    ["5-keeper", tops[4][0]],
    ["6-inside", tops[5][0] + 40],
  ];
  for (const [label, y] of stops) {
    await page.evaluate((y) => window.scrollTo(0, y), y);
    await page.waitForTimeout(label === "3-drop" ? 3200 : 1600);
    await page.screenshot({ path: `${out}/${name}-${label}${theme ? "-" + theme : ""}-${tier}.png` });
  }
  const ds = await page.evaluate(() => ({ ...document.documentElement.dataset }));
  console.log(name, JSON.stringify(ds));
  await ctx.close();
}
await browser.close();
