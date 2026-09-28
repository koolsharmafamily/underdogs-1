# Demo Notes — Underdogs Innercircle

Every assumption, placeholder, and demo value in this build, for the Underdogs crew to confirm or replace.
Source of truth: [Blueprint.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Blueprint.pdf), [Demo build prompt.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Demo%20build%20prompt.pdf), [Production brief.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Production%20brief.pdf), and [PLAN.md](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/PLAN.md).

Status: **All phases complete (Ticketing, Payment Gateway & Door Scanner removed per owner direction).**

---

## Scope Customisations Confirmed by Owner

1. **No Ticketing or Payment Gateway**:
   - All Razorpay integration, demo UPI sheets, paid holds, ticket tiers (`tiers`, `orders`, `order_items`, `tickets`), and monetary fields (`price_paise`) have been removed.
   - Public Underdogs nights (`/nights`, `/nights/[slug]`) link externally to the official Underdogs Entertainment SortMyScene organiser profile (`https://sortmyscene.com/p/underdogs-entertainment`).
2. **Exclusive Coin Claim & Curated RSVP Review**:
   - Claiming a personal coin at `/coin/[token]` requires the guest to verify their phone number via OTP and submit their RSVP details (Full Name for rim engraving, Instagram handle, companion details, and note).
   - Submitting those details mints the personalized 3D gold coin (with engraved name & sequential serial number) and displays the velvet-rope notification:
     > *"Your coin is minted and your details are with the Innercircle. The Innercircle crew will get back to you personally regarding your RSVP confirmation."*
   - The Crew Console (`/crew`) displays claimed coins and their submitted RSVP details so the crew can confirm the RSVP (`rsvpStatus = "confirmed"`), which unlocks the timed Location Drop at `drop_at`.
3. **No Door Check-In Features**:
   - The `/door` route, rotating HMAC QR codes, and door check-in states have been removed completely.

---

## Values the Crew Needs to Confirm

| What | Demo Value | Where It Lives |
| :--- | :--- | :--- |
| **Next Innercircle Night** | `"The Gold Room (Demo)"`, theme `vault`, first Saturday at least 12 days after seed date, 9 PM to 3 AM IST | `src/lib/db/seed.ts` |
| **Location Drop Time** | 72 hours before doors | `src/lib/db/seed.ts` |
| **Guest-List Capacity** | 40 confirmed RSVPs | `src/lib/db/seed.ts` |
| **Sound, Dress Code & Access Policy** | `House, Afro, Hip Hop`; `"All black, one gold thing."`; `"Confirmed Innercircle coin-holders and their approved companions."` | `src/lib/db/seed.ts` |
| **Venue (Before & After Drop)** | `"Venue (Demo)"`, `"Address (Demo), Civil Lines, Nagpur"`, Google Maps link to Civil Lines, Nagpur | `src/lib/db/seed.ts` |
| **Public Nights** | Two `"Underdogs Saturday (Demo)"` nights on the two Saturdays after the Gold Room, 10 PM to 3 AM, 21+, linking to SortMyScene | `src/lib/db/seed.ts` |
| **FAQ Answers** | Seven demo defaults (dress code, age, access policy, plus-ones, RSVP confirmation, location drop, photos) | `src/lib/db/seed.ts` |

---

## Real Facts Used (Section 2 of the Brief Only)

- **Launch night × Live By All Means**: Saturday 6 June 2026, Millo, Civil Lines, Nagpur, with DJ Monish, by invitation only. Card art uses `Launch Post.png`.
- **La Dolce Vita, 80s edition**: Saturday 12 September 2026, Millo, Civil Lines, Nagpur, with DJs Luna and Monish, compulsory 80s dress code, and F Salon by FTV as brand partner (text only).
- **Underdogs Wonderland – NYE 2026**: 31 December 2025, Ashirwad Banquets, Nagpur (Bollywood, Commercial, Hip Hop, Afro).
- **Partner rule**: Partners (`Millo`, `Live By All Means`, `F Salon by FTV`) appear as text only. `Animation Theme.png` and `Post example.png` are never rendered on the site so partner bottle labels/marks are never reproduced.

---

## Demo Personas

All fictional, all marked `(Demo)`. None of the phone numbers is ever contacted externally; all messages go to the in-app WhatsApp Outbox preview.

| Persona | Phone | Role | State at Seed |
| :--- | :--- | :--- | :--- |
| `Aarav (Demo)` | `+91 90000 10001` | `guest` | No request yet (submits one live in the demo story) |
| `Meera (Demo)` | `+91 90000 10002` | `guest` | Approved, Coin `Nº 0001` (`MEERA`) claimed, RSVP confirmed for The Gold Room |
| `Kabir (Demo)` | `+91 90000 10003` | `guest` | Invite request waitlisted, first in line on The Gold Room waitlist |
| `Admin (Demo)` | `+91 90000 10005` | `admin` | Crew persona for `/crew` review queue, RSVP confirmations & direct coin minting |
