# Build Plan: Underdogs Innercircle (No Ticketing / No Payment Gateway / No Door Check-in)

Source of truth: [Blueprint.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Blueprint.pdf), [Demo build prompt.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Demo%20build%20prompt.pdf), [Production brief.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Production%20brief.pdf), and [Reference teardown.pdf](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Reference%20teardown.pdf), adapted per user direction:
1. **No ticketing or payment gateway features** (no Razorpay, no UPI sheet, no prices/tiers/orders/tickets).
2. **Exclusive Coin Claim & RSVP Review**: Claiming a coin at `/coin/[token]` requires submitting guest details (Name, Phone + OTP, Instagram handle, guest/plus-one details) to mint the personalized gold coin, and displays an exclusive velvet-rope notification that **the Innercircle crew will get back to you personally regarding your RSVP** (crew can then confirm the RSVP in `/crew`).
3. **No door check-in features** (no `/door` scanner, no QR codes, no check-in toggles anywhere).

---

## 0. Scope Adjustments: What Is Removed vs. Retained

### Removed
1. **Payment Gateway**:
   - No Razorpay integration (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `/api/razorpay/webhook`).
   - No Demo UPI checkout sheet or payment simulation.
   - No monetary columns (`price_paise`, `amount_paise`) or GST/refund workflows.
2. **Ticketing, Seat Holds & Door Check-In**:
   - Removed database tables: `tiers`, `orders`, `order_items`, `tickets`.
   - No 10-minute payment holds or paid-stock reservations.
   - No rotating QR codes (`TICKET_HMAC_SECRET`, `qrcode`, `@zxing/browser`), no `/door` route, and no door check-in state anywhere.
   - No "Ticket rush" simulator in the Demo Panel.

### Retained & Refined (Exclusive Innercircle Journey, 3D Coin, Location Drop & Goldie)
1. **The 3D Gold Coin Journey**:
   - Single persistent `<Canvas>` (`@react-three/fiber` + `@react-three/drei` `View` portals) with 4 quality tiers (`Full`, `Lite`, `Still`, `No WebGL`).
   - All 6 home page chapters (`The vault`, `Heads or tails`, `The drop`, `Through the circle`, `The keeper`, `Been inside`) and both theme worlds (`vault` and `aegean`).
2. **Innercircle Invite, Coin Claim & Curated RSVP Flow**:
   - **Request an Invite**: Guest verifies phone via OTP and submits the invite request form (name, optional Instagram handle, favourite nights, who they would bring, optional member vouch code).
   - **Crew Invite Review**: Crew reviews requests in `/crew` with Goldie's AI summary & flags (`approve` sends a personal coin link, `waitlist`, `decline`), or sends direct coin links to regulars.
   - **Claim Your Coin (`/coin/[token]`)**: Opening the personal coin link prompts the guest to enter/confirm their details (Name, Phone + OTP, Instagram handle, RSVP details / companion notes) to claim and mint their coin (`"AARAV"` engraved on the rim, sequential serial `Nº 0001`, gold confetti burst). Submitting displays the exclusive notification:
     > *"Your coin is minted and your RSVP details are with the circle. The Innercircle crew will get back to you personally regarding your RSVP confirmation."*
   - **Crew RSVP Confirmation & Timed Location Drop**: Once the crew confirms the guest's RSVP in `/crew`, the guest is confirmed for the night. Before `drop_at` (72 hours before doors), the site and Goldie show only the general area (`Civil Lines, Nagpur`). At `drop_at`, confirmed guests receive the crimson drop reveal with the exact venue name, address, and Google Maps link on the page and in their WhatsApp outbox.
3. **Public Underdogs Nights (`/nights`, `/nights/[slug]`)**:
   - Server-rendered event showcase pages with `schema.org/Event` JSON-LD (IST `+05:30`), per-night OG images, and external link to Underdogs Entertainment's SortMyScene organiser profile (`https://sortmyscene.com/p/underdogs-entertainment`).
4. **Goldie, the AI Concierge (`/api/goldie`)**:
   - The 3D coin's X-eyed face animates across 7 presence states (`idle`, `listening`, `thinking`, `speaking`, `celebrating`, `hushed`, `sorry`) and streams replies with a structured mood label (`warm`, `hype`, `hushed`, `sorry`, `celebrate`).
   - Works online via Vercel AI SDK + Gemini (`@ai-sdk/google`) and offline via a deterministic intent router (`Offline mode`), calling guarded domain tools with zero venue leaks before `drop_at`.

---

## 1. Brand Assets & Visual System

| Asset | Usage on the Site |
| :--- | :--- |
| [Logo.jpg](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Logo.jpg) | Canonical gold coin reference: milled beaded rim, brushed gold ring engraved `"UNDERDOGS"` twice, filigree band, domed onyx centre, faceted gold X eyes, gold crescent smile and tongue. Used for 3D coin textures/materials, `No WebGL` and `Still` fallbacks, favicon, OG images, and Goldie's avatar. |
| [Post example.png](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Post%20example.png) | Teaser lockup reference (`Logo.jpg` coin over `X BY ALL MEANS` and gold script `stay tuned`). |
| [Animation Theme.png](file:///c:/Users/kulvi/Desktop/Websites/Underdogs%201/Animation%20Theme.png) | Visual reference only for Chapter 3 (`The drop`): champagne flute standing on the gold coin coaster, crimson splash, black satin drapes, and gold ribbon confetti. **Never displayed directly or with the partner bottle label reproduced.** |
| `innercircle-tokens.css` | All colour and typography tokens (`--ic-void`, `--ic-onyx`, `--ic-satin-*`, `--ic-gold-*`, `--ic-ivory`, `--ic-ember*`, `--ic-drop*`, and `[data-theme="aegean"]` overrides). |

---

## 2. Database Schema (11 Tables)

All domain rules live in `src/lib/domain/*` and take `(db, actor, input)`.

| Table | Columns & Key Rules |
| :--- | :--- |
| `guests` | `id`, `phone` (unique, verified), `name`, `instagram_handle`, `dob`, `consent_flags` (JSONB), `role` (`guest` \| `crew` \| `admin`), `created_at`. |
| `venues` | `id`, `name`, `area`, `address`, `maps_url`. Exact `name`, `address`, and `maps_url` never leave the server before `drop_at` except for `crew`/`admin`. |
| `events` | `id`, `slug`, `kind` (`public` \| `innercircle`), `theme` (`vault` \| `aegean`), `title`, `sound_tags` (array), `starts_at`, `ends_at`, `timezone` (`Asia/Kolkata`), `venue_id`, `drop_at`, `capacity`, `confirmed_count`, `min_age`, `dress_code`, `door_policy`, `accent`, `poster_url`, `status` (`draft` \| `published` \| `archived`), `sortmyscene_url`. |
| `invite_requests` | `id`, `guest_id`, `event_id`, `answers` (JSONB), `vouch_code`, `status` (`submitted` \| `in_review` \| `approved` \| `waitlisted` \| `declined` \| `withdrawn`), `reviewed_by`, `reviewed_at`, `ai_summary` (JSONB), `crew_notes`, `created_at`. |
| `coins` | `id`, `token_hash` (SHA-256 of 32 random bytes), `guest_id` (nullable until claimed), `event_id`, `plus_ones` (int), `claim_details` (JSONB: name, instagram, companion details, note), `serial` (e.g., `Nº 0001`), `expires_at`, `rsvp_status` (`pending_review` \| `confirmed` \| `waitlisted` \| `declined`), `status` (`sent` \| `claimed` \| `expired` \| `revoked`). |
| `waitlist_entries` | `id`, `event_id`, `guest_id`, `status` (`waiting` \| `offered` \| `claimed` \| `expired` \| `left`), `offer_expires_at`, `created_at`. |
| `status_log` | `id`, `entity`, `entity_id`, `from_status`, `to_status`, `actor_id`, `reason`, `created_at`. |
| `chat_sessions` | `id`, `guest_id`, `expires_at`, `created_at` (purged after 30 days). |
| `chat_messages` | `id`, `session_id`, `role`, `content`, `mood`, `tool_result` (JSONB), `created_at`. |
| `faqs` | `id`, `slug`, `question`, `answer`, `event_id` (nullable), `updated_at`. |
| `messages_out` | `id`, `channel` (`whatsapp` \| `email`), `template`, `to_phone`, `guest_id`, `payload` (JSONB), `status`, `created_at`. |
| `demo_settings` | `id`, `clock_offset_ms`, `theme_override`, `tier_override`, `updated_at`. |
