<div align="center">

# 🔍 LostLink — NCET Lost & Found
### Find It. Match It. Get It Back.

**LostLink is NCET's lost & found system. A student who finds something posts it with a photo, a student who lost something raises a complaint, and the app matches them privately — only the real owner ever sees the full details.**

[![Live](https://img.shields.io/badge/Live-Render-0e2455?style=for-the-badge)](https://lostlink-ncet.onrender.com)
[![Stack](https://img.shields.io/badge/Stack-Supabase-3ecf8e?style=for-the-badge)](#-stack--supabase-for-everything)
[![Hackathon](https://img.shields.io/badge/INNOVATE_2.0-Hackathon-f6872a?style=for-the-badge)](#-disclosure-innovate-20-rules)

[🚀 Quick start](#-quick-start) •
[⚙️ How it works](#-how-it-works) •
[🔐 Login](#-login--college-email-only) •
[🛡️ Privacy](#-privacy) •
[🔧 Setup](#-connect-supabase-to-go-live)

</div>

---

## 📊 At a glance

| | |
|---|---|
| **App** | NCET Lost & Found — plain HTML/CSS/JS, no build step |
| **Live** | [lostlink-ncet.onrender.com](https://lostlink-ncet.onrender.com) (also on [GitHub Pages](https://1nc24cs146-cmyk.github.io/NCET-LOST-AND-FOUND/index.html)) |
| **Team** | Team LostLink — INNOVATE 2.0 Hackathon, 14 Nov 2026 |
| **College** | Nagarjuna College of Engineering & Technology (NCET), Devanahalli, Bengaluru |
| **Domain** | Web, Mobile & Cloud |
| **Stack** | Supabase for everything — Auth, Postgres, Storage |
| **Login** | NCET college email only, USN format — no Gmail, no guests, no demo logins |
| **Privacy rule** | Only the owner sees the full details; everyone else sees only that the item is there |
| **Mail** | Brevo transactional email — live, on complaint, match, confirm and delivery |

You lose an ID card, a charger, a book — and instead of a scattered WhatsApp group, you get it back through a match you confirm yourself.

## 🌟 Why LostLink?

- **No more WhatsApp groups.** Found items and lost complaints live in one place, on campus, for NCET students only.
- **Private by design.** A found item's description and the finder's mobile number are hidden from everyone except its real owner — and the other side only after a confirmed match.
- **You confirm by looking.** The match card shows the finder's photo, so you confirm it is really yours before you accept.
- **Nothing to install.** It is a mobile-first web app — open the link, log in, done.
- **It remembers you.** Log in once and the app keeps you signed in on that site, so you never log in again and again.

## 🚀 Quick start

1. **Open the app:** [lostlink-ncet.onrender.com](https://lostlink-ncet.onrender.com)
2. **Create an account** with your USN college email (for example `1nc24cs146@ncetmail.com`) and a password, or tap **Continue with NCET Mail** to sign in with Google.
3. **Found something?** Tap **Report Found Item** — item name, category, where you found it, which department to collect it from, and a photo.
4. **Lost something?** Tap **Raise a Complaint** — item name, category, and a description only you can see.
5. **Check My Matches.** A possible match appears there, with the finder's photo. Tick the confirmation line and tap **Yes, this is my item**.
6. **That's it — Delivered to Owner.** Accepting the match marks the item Delivered to Owner straight away, and both sides get a WhatsApp message and an email. Give feedback after that.

That's it. No install, no extra app.

## 🖥️ The screens at a glance

| Screen | What you do there |
|---|---|
| **Welcome** | The college first impression — NCET logo, full name, NAAC A+, motto "Innovate. Ignite. Inspire.", Est. 2001 / 25+ Years, live stats, then login |
| **Home** | The found-items board — search, categories, photos, Pending / Delivered status |
| **Upload** | Post a found item with a photo, place found, and collect-from department |
| **Complaint** | Raise a complaint for what you lost, with a private description |
| **Matches** | Your possible matches only — photo, confirm or reject, WhatsApp handover, feedback |
| **Profile** | Name, USN, college email, auto-derived department + year, mobile (yours only), your Found / Lost / Delivered counts — edit name + mobile only, USN and email are locked |

## ⚙️ How it works

1. **A finder posts a found item.** Item name, category, place found, collect-from department, and a photo. The photo goes to the public Supabase Storage bucket `item-photos`; the description and mobile number go to a private table.
2. **An owner raises a complaint.** Item name, category, and a description only the owner can see. The owner gets an email the moment the complaint is raised.
3. **The app matches them.** Same item name + category, or a close description match, creates a Possible Match — visible only to that owner, with the finder's photo. Both sides get an email.
4. **The owner confirms.** Tick the line, tap **Yes, this is my item**. Both sides get a WhatsApp message and an email, and the item is marked **Delivered to Owner** straight away. Tap **No, this is not mine** and the match is rejected.
5. **Feedback.** After delivery, the owner can rate the return and say how it went.

## 🔐 Login — college email only

Only USN-format college emails are accepted, checked **before** Supabase is called:

```
^1nc[0-9]{2}(cs|is|cd|ci|ec|cv|ic)[0-9]{3}@ncetmail\.com$
```

- Any year (21, 22, 23, 24, …). Branch codes only:

| Code | Department |
|---|---|
| CS | CSE |
| IS | ISE |
| CD | Data Science |
| CI | AIML |
| EC | ECE |
| CV | Civil |
| IC | IoT / Cyber Security |

- USN must match the email prefix: `1NC24CS146` = `1nc24cs146@ncetmail.com`.
- `nitin@ncetmail.com` and Gmail are rejected. Department is auto-derived from the branch code, never picked.

**Direct login with NCET Mail.** The **Continue with NCET Mail** button (on Welcome and on Login) uses Supabase Google OAuth (`hd: ncetmail.com`) — pick your NCET Google account, no password needed. The returned email is still checked with the strict USN rule; a non-USN or non-ncetmail account is signed out again and rejected.

### HOD login — items found by workers
Workers (housekeeping, security) have no login. When they find an item they hand it to the department, and the **HOD posts it from a separate department login**: pick Student / HOD on the login page, choose the department, enter the HOD password (account `hod-<branch>@ncetmail.com`, e.g. `hod-cs@ncetmail.com` — one account per department, created by the admin in Supabase Auth). The HOD uploads the found item as the department (finder shows as "HOD, CSE Dept", collect-from is locked to their department) and never sees the Lost/complaint tab.
When a student confirms a match on a department-held item, the item is **not** Delivered yet — the claim waits in the **HOD's Profile** under "Claims waiting for your approval", with the item photo and the claimant's USN. The HOD taps **Accept** (item becomes Delivered to Owner, both sides mailed) or **Reject** (match rejected, the complaint goes back to Waiting for Match and matching continues). Student-posted items are unchanged: the owner accepting the match marks it Delivered straight away.

**Login gate.** Nothing works until you are logged in — no demo logins, no guest access. Logged-out users only ever see the Welcome and Login screens; Home, Upload, Complaint, Matches and Profile all send you back to Welcome until you log in. Once you are in, the app keeps you signed in on that site — Render and GitHub Pages are different sites, so use the Render link as your main one.

## 📧 Email notifications

The app mails the student on 4 events, via the Brevo transactional API (called from the browser, non-blocking — a mail failure never breaks the flow):

1. **Complaint raised** — mail to the owner the moment they raise a complaint.
2. **Possible match** — mail to the owner AND the finder when a found item matches.
3. **Match confirmed** — mail to both sides when the owner confirms.
4. **Delivered to Owner** — mail to the finder when the item is marked delivered.

Owner mail goes to their USN college email (`<usn>@ncetmail.com`). Mail is **live**: the Brevo key and sender (LostLink NCET) are set in `supabase.js`, and a test mail was delivered on 14 Nov 2026. Note: the key ships in the client code, so it is a Brevo key made only for sending mail — rotate it after the hackathon.

## 🎨 Design

NCET website style, verified live from [ncet.co.in](https://ncet.co.in/) on 14 Nov 2026:

| | |
|---|---|
| **Primary** | Deep Navy `#0E2455` — header, headings, footer |
| **Accent** | NCET Orange `#F6872A` — primary buttons |
| **Hover** | Deep Orange `#F05819` — hover only |
| **Background** | White `#FFFFFF` cards on Light Grey `#F8FAFC` |

The first screen is the college impression: NCET logo, full college name, NAAC A+, motto "Innovate. Ignite. Inspire.", Est. 2001 / 25+ Years, Devanahalli — then login.

**Logo.** The header uses the original NCET logo from [ncet.co.in/favicon.png](https://ncet.co.in/favicon.png) (tree + open book emblem, "NAGARJUNA"), saved as `src/assets/ncet-logo.png`. The `logo-dark.png` / `images/NGE-Logo.png` paths on ncet.co.in return the site's HTML page, not an image, so they cannot be used — the favicon file is the verified original image. The old placeholder `src/assets/ncet-logo.svg` is no longer used.

**Mobile-first.** Sticky bottom nav (Home / Found / Lost / Matches / Profile), 48px touch targets, 16px inputs so iOS never auto-zooms, safe-area support.

## 🏗️ Stack — Supabase for everything

Auth, database and storage are all Supabase (project `lostlink-ncet`, South Asia / Mumbai). An earlier Firebase backend was removed — its Storage needed the paid Blaze plan and Google sign-in hit unauthorized-domain errors.

- **Auth:** Supabase Auth — email/password + Google OAuth.
- **Database:** Postgres tables in `supabase-schema.sql` — `users`, `found_items`, `found_items_private`, `complaints`, `complaints_private`, `matches`, `feedback` — with Row Level Security, authenticated users only, never anon. All 7 tables verified live on 14 Nov 2026.
- **Storage:** public bucket `item-photos` for item photos.

## 🛡️ Privacy

Public lists show only item, category, place found, date, photo and status. Full descriptions and mobile numbers live only in `found_items_private` and `complaints_private`, readable only by the owner — and by the other party only after a Confirmed match. This is enforced by Row Level Security in `supabase-schema.sql` and in the app code (public lists never fetch private data).

## 💻 How to run

No build step — plain HTML/CSS/JS.

```bash
cd lostlink-app
python3 -m http.server 8000
# open http://localhost:8000
```

Or open `index.html` directly in a browser (use the server above for the cleanest run). In Antigravity, run it with Live Server at `127.0.0.1:5500`.

## 🧪 Demo Mode (no Supabase project yet)

If `supabase.js` still has the placeholder config, the app runs fully in **Demo Mode** — a banner says so, and the same flows work with dummy data in localStorage: create account, login, upload, complaint, private matching, WhatsApp preview, Pending/Delivered, feedback, profile. There are NO demo logins: create your own account with your USN college email and a password (min 6 characters).

Demo flow to try: Create an account with your own NCET mail → Upload a found item (e.g. a black Boat charger) → Logout → Create a second account with another USN mail → Raise a Complaint for the same charger with "black Boat" in the description → see Possible Match in My Matches → tick the confirmation and tap "Yes, this is my item" → WhatsApp preview appears, status becomes Delivered to Owner → give feedback.

## 🔧 Connect Supabase (to go live)

1. Create a free project at [supabase.com/dashboard](https://supabase.com/dashboard) (or use the existing `lostlink-ncet` project).
2. Run `supabase-schema.sql` in the Supabase dashboard: SQL Editor → New query → paste the whole file → Run. This creates all tables, enables Row Level Security, and adds the storage policies. The `item-photos` bucket must exist and be Public (Storage → New bucket → `item-photos`, Public).
3. Enable the Google provider: Authentication → Providers → Google → turn it on. This needs a Google OAuth client ID and secret, which you create in Google Cloud Console (APIs & Services → Credentials → Create OAuth client ID → Web application) — add the Supabase callback URL shown on the provider page as an authorized redirect URI in Google Cloud.
4. Add redirect URLs under Authentication → URL Configuration. Site URL is the GitHub Pages URL; the full allowed list is: `http://localhost:5500/index.html`, `https://lostlink-ncet.onrender.com`, `https://lostlink-ncet.onrender.com/index.html`, `https://1nc24cs146-cmyk.github.io/NCET-LOST-AND-FOUND/index.html`, plus both bare roots with a trailing slash. Supabase only honours a redirect that exactly matches this list — a bare root that is not listed falls back to the Site URL, so the Google login would land on the wrong copy of the site.
5. Turn off email confirmation for the demo (Authentication → Providers → Email → Confirm email OFF), so sign-up logs the user in immediately. If it stays on, new users must click the confirmation link in their NCET mail before they can log in.
6. Paste your Project URL and anon public key into `supabase.js` (never the service_role key). Then push.

## 📂 Files

| File | What it is |
|---|---|
| `index.html` | Welcome, Login, Home, Upload, Complaint, Matches, Profile |
| `styles.css` | NCET design system, mobile-first (390px, no horizontal scroll) |
| `app.js` | All screens, validation, matching, WhatsApp, Delivered, feedback, stay-signed-in session restore |
| `supabase.js` | Supabase client (URL + anon key), photo upload to the `item-photos` bucket, Brevo key + sender |
| `supabase-schema.sql` | All tables + Row Level Security policies + storage policies (run once in the SQL Editor) |
| `src/assets/ncet-logo.png` | The real NCET logo |
| `src/assets/ncet-campus.jpg` | The NCET gate photo used as the hero background |
| `firestore.rules`, `storage.rules` | Unused legacy files from the old backend; leave them in the repo, they are not used by the app |

## 🔧 Troubleshooting

- **"User already registered"** — the account already exists in Supabase. Use Login, not Create Account, with the password you set.
- **"Invalid login credentials"** — wrong password for that USN email. Use Forgot Password, or sign in with **Continue with NCET Mail**.
- **Google login lands on the other site** — the redirect list in Supabase must contain the exact URL you started from (see step 4 above). The app always asks to return to `…/index.html`, which is in the list on every host.
- **Login asked again after closing the app** — the session is remembered per site. If you logged in on GitHub Pages and open the Render link, that is a different site and asks again. Use one link — Render — as the main one.
- **Photo does not upload** — the `item-photos` bucket must be Public, with the view + upload policies from `supabase-schema.sql`. The item still saves without a photo if upload fails.
- **No mail arrives** — check the Brevo key and the verified sender in `supabase.js`, and check spam. Mail is non-blocking, so the app never shows a mail error.

## 📄 Disclosure (INNOVATE 2.0 rules)

A 50% prototype of NCET Lost & Found was built on 13 Nov 2026 (home page, board with Lost/Found/Returned tabs, posting lost/found items, match suggestions, claim flow). This build extends that pre-existing prototype with the full Supabase backend, Welcome screen, strict USN-email login, Profile page, privacy rules, WhatsApp handover, Delivered status and feedback. Significant parts were written with AI assistance. All data in the demo is dummy / anonymised — no real student data is used.

---

*LostLink — Team LostLink, INNOVATE 2.0 Hackathon, NCET. Find It. Match It. Get It Back.*
