# LostLink — NCET Lost & Found

**Team LostLink — INNOVATE 2.0 Hackathon, 14 Nov 2026**
School of Computing, Nagarjuna College of Engineering & Technology (NCET), Devanahalli, Bengaluru.
Domain: Web, Mobile & Cloud.

## Problem
Students lose ID cards, chargers and books on campus, with no system to get them back — just scattered WhatsApp groups.

## Solution
NCET students post found items with a photo, raise a complaint for what they lost, and the app matches them privately. Only the real owner sees the full details. After the owner confirms a match, both sides get a WhatsApp message, the item is collected from the department, and the app shows **Pending** until the owner taps "I received my item" — then **Delivered to Owner**. Feedback is collected only after delivery.

## Stack — Supabase for everything
Auth, database and storage are all Supabase (project `lostlink-ncet`, South Asia / Mumbai). The previous backend was removed because its Storage needed the paid Blaze plan and Google sign-in hit unauthorized-domain errors.
- **Auth:** Supabase Auth — email/password + Google OAuth.
- **Database:** Postgres tables in `supabase-schema.sql` (users, found_items, found_items_private, complaints, complaints_private, matches, feedback) with Row Level Security — authenticated users only, never anon.
- **Storage:** public bucket `item-photos` for item photos.

## Design
NCET website style, verified from https://ncet.co.in/ on 14 Nov 2026: Deep Navy `#0E2455` (header, headings, footer), NCET Orange `#F6872A` (primary buttons), Deep Orange `#F05819` (hover only), White `#FFFFFF` cards on Light Grey `#F8FAFC`. The first screen is the college impression: NCET logo, full college name, NAAC A+, motto "Innovate. Ignite. Inspire.", Est. 2001 / 25+ Years.

## Logo
The header uses the original NCET logo from https://ncet.co.in/favicon.png
(tree + open book emblem, “NAGARJUNA”), saved as `src/assets/ncet-logo.png`.
The `logo-dark.png` / `images/NGE-Logo.png` paths on ncet.co.in return the site's
HTML page, not an image, so they cannot be used — the favicon file is the
verified original image. The old placeholder `src/assets/ncet-logo.svg` is
no longer used.

## Direct login with NCET Mail
On the Login page there is a **“Continue with NCET Mail”** button (also on the
Welcome screen). It uses Supabase Google OAuth (`hd: ncetmail.com`) — pick your NCET Google account, no password needed.
The returned email is still checked with the strict USN rule
(`^1nc[0-9]{2}(cs|is|cd|ci|ec|cv|ic)[0-9]{3}@ncetmail\.com$`, USN must match
the email, department auto-derived); a non-USN or non-ncetmail account is
signed out again and rejected. In Demo Mode the button asks you to connect Supabase first (no real Google OAuth in Demo Mode).

## How to run
No build step — plain HTML/CSS/JS.
```bash
cd lostlink-app
python3 -m http.server 8000
# open http://localhost:8000
```
Or open `index.html` directly in a browser (use the server above for the cleanest run).

## Login — college email only
Only USN-format college emails are accepted, checked **before** Supabase is called:
`^1nc[0-9]{2}(cs|is|cd|ci|ec|cv|ic)[0-9]{3}@ncetmail\.com$`
- Any year (21, 22, 23, 24, …). Branch codes only: CS=CSE, IS=ISE, CD=Data Science, CI=AIML, EC=ECE, CV=Civil, IC=IoT / Cyber Security.
- USN must match the email prefix: `1NC24CS146` = `1nc24cs146@ncetmail.com`.
- `nitin@ncetmail.com` and Gmail are rejected. Department is auto-derived from the branch code, never picked.

## Login gate
Nothing works until the user is logged in — no demo logins, no guest access. Logged-out users only ever see the Welcome and Login screens; Home, Upload, Complaint, Matches and Profile all send you back to Welcome until you log in.

## Demo Mode (no Supabase project yet)
If `supabase.js` still has the placeholder config, the app runs fully in **Demo Mode** — a banner says so, and the same flows work with dummy data in localStorage: create account, login, upload, complaint, private matching, WhatsApp preview, Pending/Delivered, feedback, profile. There are NO demo logins: create your own account with your USN college email and a password (min 6 characters).

Demo flow to try: Create an account with your own NCET mail → Upload a found item (e.g. a black Boat charger) → Logout → Create a second account with another USN mail → Raise a Complaint for the same charger with "black Boat" in the description → see Possible Match in My Matches → tick the confirmation and tap "Yes, this is my item" → WhatsApp preview appears, status stays Pending → tap "I received my item" → Delivered to Owner → give feedback.

## Connect Supabase (to go live)
1. Create a free project at https://supabase.com/dashboard (or use the existing `lostlink-ncet` project).
2. Run `supabase-schema.sql` in the Supabase dashboard: SQL Editor → New query → paste the whole file → Run. This creates all tables, enables Row Level Security, and adds the storage policies. The `item-photos` bucket must exist and be Public (Storage → New bucket → `item-photos`, Public).
3. Enable the Google provider: Authentication → Providers → Google → turn it on. This needs a Google OAuth client ID and secret, which you create in Google Cloud Console (APIs & Services → Credentials → Create OAuth client ID → Web application) — add the Supabase callback URL shown on the provider page as an authorized redirect URI in Google Cloud.
4. Add redirect URLs under Authentication → URL Configuration: Site URL plus `http://localhost:5500/index.html` and `https://1nc24cs146-cmyk.github.io/NCET-Lost-And-Found-/index.html`.
5. Turn off email confirmation for the demo (Authentication → Providers → Email → Confirm email OFF), so sign-up logs the user in immediately. If it stays on, new users must click the confirmation link in their NCET mail before they can log in.
6. Paste your Project URL and anon public key into `supabase.js` (never the service_role key). Then push.
7. Replace `src/assets/ncet-logo.svg` with the real NCET logo downloaded from the header of https://ncet.co.in/ (do not hotlink a guessed URL).

## Email notifications (after a complaint is raised)
The app mails the student on 4 events, via the Brevo transactional API (called from the browser, non-blocking — a mail failure never breaks the flow):
1. **Complaint raised** — mail to the owner the moment they raise a complaint.
2. **Possible match** — mail to the owner AND the finder when a found item matches.
3. **Match confirmed** — mail to both sides when the owner confirms.
4. **Delivered to Owner** — mail to the finder when the owner taps "I received my item".
Owner mail goes to their USN college email (`<usn>@ncetmail.com`). To turn mail on, set `BREVO_API_KEY` and `BREVO_SENDER` in `supabase.js` (sender must be verified in your Brevo account). Until the key is real, mail is skipped silently. Note: the key ships in the client code, so use a Brevo key made only for sending mail.

## Privacy
Public lists show only item, category, place found, date, photo and status. Full descriptions and mobile numbers live only in `found_items_private` and `complaints_private`, readable only by the owner — and by the other party only after a Confirmed match. This is enforced by Row Level Security in `supabase-schema.sql` and in the app code (public lists never fetch private data).

## Files
- `index.html` — Welcome, Login, Home, Upload, Complaint, Matches, Profile
- `styles.css` — NCET design system, mobile-first (390px, no horizontal scroll)
- `app.js` — all screens, validation, matching, WhatsApp, Pending/Delivered, feedback
- `supabase.js` — Supabase client (URL + anon key), photo upload to the `item-photos` bucket
- `supabase-schema.sql` — all tables + Row Level Security policies + storage policies (run once in the SQL Editor)
- `src/assets/ncet-logo.png` — the real NCET logo
- `firestore.rules`, `storage.rules` — unused legacy files from the old backend; leave them in the repo, they are not used by the app.

## Disclosure (INNOVATE 2.0 rules)
A 50% prototype of NCET Lost & Found was built on 13 Nov 2026 (home page, board with Lost/Found/Returned tabs, posting lost/found items, match suggestions, claim flow). This build extends that pre-existing prototype with the full Supabase/Demo backend, Welcome screen, strict USN-email login, Profile page, privacy rules, WhatsApp handover, Delivered/Pending status and feedback. Significant parts were written with AI assistance. All data in the demo is dummy / anonymised — no real student data is used.
