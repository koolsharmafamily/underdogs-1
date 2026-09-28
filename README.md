# Underdogs Innercircle

The invite-only community and 3D gold coin experience for **Underdogs Innercircle** (Nagpur, India), built with Next.js App Router, React 19, Three.js / React Three Fiber, GSAP ScrollTrigger, Drizzle ORM (embedded PGlite + Postgres), and Goldie (the AI concierge).

## Quick Start (Zero Setup Required)

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.
- **Database**: Uses embedded **PGlite** (`.data/pglite`) automatically when `DATABASE_URL` is unset, running migrations and seeding demo data on first start.
- **Demo Controls**: Click the **Demo** pill at the bottom-left (or press `Shift+D`) to switch personas (`Aarav`, `Meera`, `Kabir`, `Crew / Admin`), time-travel (`+1h`, `Jump to drop`, `Jump to doors`, `Reset clock`), switch worlds (`The Vault` vs. `The Aegean`), switch 3D quality tiers (`Full`, `Lite`, `Still`, `No WebGL`), simulate an RSVP cancellation for the waitlist, or inspect the WhatsApp Outbox preview.

---

## The 5-Minute Presenter Script

1. **The Vault (`/`)**: Open the home page on mobile (`390 px`) or desktop (`1440 px`). Watch the 3D gold coin spin on its edge in black satin with copper firelight and scroll through the six chapters (*The vault* $\rightarrow$ *Heads or tails* $\rightarrow$ *The drop* $\rightarrow$ *Through the circle* $\rightarrow$ *The keeper* $\rightarrow$ *Been inside*).
2. **Different Worlds, Same Coin**: Open the Demo Panel (`Shift+D`) and switch the World Theme to **The Aegean**. The backdrop transforms into Santorini night navy with 80s chrome rings while the gold coin remains constant.
3. **Ask Goldie**: In Chapter 5 (*The keeper*), click the quick chips or type:
   - *"What's the next night?"* $\rightarrow$ Returns the upcoming night card.
   - *"Where is it?"* $\rightarrow$ Coin dims into the `hushed` state and explains the address drops 72 hours before doors.
   - *"Can I bring a friend?"* $\rightarrow$ Answers from the crew's FAQ.
   - *"Get me in"* $\rightarrow$ Drafts an invite request card in chat.
4. **Request an Invite (`/innercircle`)**: Switch persona to `Aarav (Demo)` (or verify `+91 90000 10001` with the on-screen demo OTP toast) and submit the invite request form.
5. **Crew Review (`/crew`)**: Switch persona to `Crew / Admin (Demo)`. Open `/crew`, read Goldie's structured summary and flags on Aarav's request, and click **Approve & Send Coin (+1)**.
6. **Claim Your Coin & Exclusive RSVP Review (`/coin/[token]`)**: Open the freshly minted coin link from `/crew` or from the Demo Panel's **WhatsApp Outbox Preview** (switch back to `Aarav (Demo)`). Submit Aarav's details to mint the coin with `"AARAV"` engraved on the gold rim and serial `Nº 0002`, displaying the velvet-rope notification that **the Innercircle crew will get back to you personally regarding your RSVP**.
7. **Crew RSVP Confirmation & Timed Location Drop**: In `/crew` (as `Crew / Admin`), click **Confirm RSVP** on Aarav's claimed coin. Then open the Demo Panel and click **Jump to drop** — on `/innercircle/the-gold-room` and `/me`, the secret venue and Google Maps link are revealed!
8. **Waitlist Hand-off**: Click **Simulate RSVP cancellation** in the Demo Panel and watch `Kabir (Demo)` receive a timed coin offer in the WhatsApp Outbox.
9. **Graceful Everywhere**: Switch the 3D Tier between `Full`, `Lite`, `Still`, and `No WebGL` in the Demo Panel.

---

## Scripts

- `npm run dev` — Start development server
- `npm run typecheck` — Run Next.js typegen and TypeScript strict check
- `npm run lint` — Run ESLint
- `npm run test` — Run Vitest unit & 26-prompt Goldie security/leak eval suite
- `npm run build` — Production build
- `npm run check` — Run typecheck, lint, tests, and production build
