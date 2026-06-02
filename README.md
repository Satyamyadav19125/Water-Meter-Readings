# Water Meter Dashboard

A Vercel-hosted mirror of your KoboToolbox water-meter readings, with:

- 📅 **Pending tracker** — see which meters still need a reading this week (twice-weekly cycle)
- 🚩 **Red flag detection** — automatically flags impossible readings (e.g., meter went backwards)
- 📸 **Photo viewing** — see the photo the surveyor took
- 👥 **Assignments** — track who is responsible for which village
- 🪞 **Kobo-style view** — browse submissions like in Kobo's own UI

The form data **stays in Kobo**. This app only *reads* from Kobo's API and *displays* the data nicely.

---

## ⚠️ Before you do anything else

**Regenerate your Kobo API token.** The old one was shared in a chat and is no longer safe.

1. Log in to KoboToolbox
2. Click your account icon → **Account Settings** → **Security**
3. Click **Regenerate** next to your API token
4. Copy the new token. Keep it private.

---

## What you need installed on your laptop

You only need these to test locally. If you skip local testing, you can do everything from your browser using GitHub + Vercel — but local testing is faster while you're learning.

1. **Node.js** (version 18 or higher) — https://nodejs.org/
2. **Git** — https://git-scm.com/
3. A free **GitHub** account — https://github.com/
4. A free **Vercel** account — https://vercel.com/ (sign up using your GitHub account so they're linked)

---

## Step-by-step setup

### Step 1. Find your Kobo Asset UID

The Asset UID identifies your form. It's different from the URL you shared.

1. Open KoboToolbox in your browser
2. Open your water meter form (click on it)
3. Look at the URL in your browser's address bar. It will look like:
   `https://kf.kobotoolbox.org/#/forms/aXyZ12345abcDEF67/summary`
4. Copy the part after `/forms/` and before the next `/` — that's your **Asset UID** (e.g. `aXyZ12345abcDEF67`).

### Step 2. Put this code on GitHub

1. Go to https://github.com/new
2. Repository name: `water-meter-dashboard` (or anything you like)
3. Set it to **Private** (recommended — your assignments file may contain phone numbers)
4. Click **Create repository**
5. On the new empty repo page, look at the section **"…or push an existing repository from the command line"**
6. Open a terminal on your laptop, `cd` into the folder containing these files, and run:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/water-meter-dashboard.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your GitHub username.

### Step 3. Deploy on Vercel

1. Go to https://vercel.com/new
2. Choose **Import Git Repository**
3. Pick `water-meter-dashboard` from the list
4. Before clicking **Deploy**, expand the **Environment Variables** section and add these four:

   | Name | Value |
   |------|-------|
   | `KOBO_API_TOKEN` | (your newly regenerated token) |
   | `KOBO_BASE_URL` | `https://kf.kobotoolbox.org` |
   | `KOBO_ASSET_UID` | (the UID from Step 1) |
   | `WEBHOOK_SECRET` | (any long random string — make one up) |

5. Click **Deploy**. Wait ~2 minutes.
6. Vercel gives you a URL like `https://water-meter-dashboard-xxx.vercel.app` — open it.

### Step 4. Map your form's field names

The first time you visit, the home page might show empty/blank fields. That's because every Kobo form uses different question names, and the app needs to know yours.

1. Visit `/debug` on your site (e.g. `https://your-app.vercel.app/debug`)
2. You'll see the raw JSON of recent submissions
3. Note the actual keys for: village, meter serial, start reading, end reading, photo
4. In your GitHub repo, edit `lib/fieldMap.js` directly in the GitHub web UI:
   - Click the file → click the pencil ✏️ icon
   - Replace the right-hand side of each line with your actual key name
   - Click **Commit changes**
5. Vercel automatically rebuilds in ~1 minute. Refresh the page.

### Step 5. Set up the webhook (so the dashboard updates instantly)

By default, the dashboard refreshes every 60 seconds. If you want **instant** updates when someone submits a form:

1. In KoboToolbox, open your form → **Settings** → **REST Services** → **Register a New Service**
2. **Name:** "Water Meter Dashboard"
3. **Endpoint URL:**
   `https://YOUR-APP.vercel.app/api/webhook?secret=YOUR_WEBHOOK_SECRET`
   (replace both placeholders with your real values from Step 3)
4. Save.

Kobo will now POST to your app each time a form is submitted, and the cached pages will refresh instantly.

### Step 6. Add your real assignments

1. In GitHub, open `data/assignments.json`
2. Edit it to add your real people, villages, and meter serial numbers
3. Commit. Vercel auto-redeploys in ~1 minute.

That's it — you have a working dashboard.

---

## How to use day-to-day

- **"Pending this week" (home page)** — Show this to your team. Anyone whose meter shows red **Pending** has not submitted yet this week. Yellow **Partial** = one reading done, one still needed.
- **"All submissions"** — Browse everything. Rows highlighted in pink are red-flagged. Click a row to expand and see the photo + all fields.
- **"Kobo view"** — Looks like Kobo's own submission viewer. Useful for the field staff to confirm what was actually submitted.
- **"Assignments"** — Read-only list. To change, edit `data/assignments.json` in GitHub.
- **"Debug"** — Raw JSON, mostly for setup.

---

## How red flags work

A water meter is a counter — it can only count up. The app flags three kinds of suspicious readings:

1. **Reverse** — Within one submission, the end reading is less than the start reading.
2. **Rollback** — The current end reading is less than the previous submission's end reading for the same meter.
3. **Huge jump** — The reading jumped by more than 100,000 between submissions (likely a typo with an extra digit).

When you see 🚩 in the table, click the row to expand and read why. Then check the photo (also in the expanded view) to see what the meter actually shows.

---

## Frequently asked

**Q. What if I want to send email/SMS reminders to people whose meter is still pending?**
That's a phase 2 feature. The cleanest way: add a Vercel Cron job (free tier) that runs every day at 9 AM, checks the pending list, and sends emails via [Resend](https://resend.com/) (also free for low volume). Ask me when you're ready and I'll add it.

**Q. Can I show a map of all the meter locations?**
Yes — and given your background, this is the natural next addition. Kobo's GPS field is stored in `_geolocation`. We can drop in a Leaflet map (you already have experience with that from the AWD dashboard) on a new `/map` route. Phase 2.

**Q. Where is the data stored?**
**In Kobo, exactly as before.** This app only reads from Kobo's API. The only thing stored in your GitHub repo is the assignments list (`data/assignments.json`).

**Q. What does it cost?**
$0. Vercel's hobby tier is free for personal projects. GitHub private repos are free. Kobo is unchanged.

**Q. Something broke.**
Check the Vercel logs: your project → **Deployments** → most recent → **Functions** tab. The most common issue is a wrong field name in `lib/fieldMap.js` — visit `/debug` and double-check.

---

## File tour (for when you want to change things)

```
app/
  page.jsx              Home (pending tracker)
  dashboard/page.jsx    All submissions table
  kobo-view/page.jsx    Kobo-style submission detail
  assignments/page.jsx  Read-only assignments
  debug/page.jsx        Raw JSON for setup
  api/
    webhook/route.js    Receives Kobo webhook
    photo/route.js      Proxies Kobo photos to the browser

components/
  SubmissionTable.jsx   Expandable submission table

lib/
  kobo.js               Kobo API client
  fieldMap.js           ★ Edit this once to match your form
  redflags.js           Red flag detection logic
  weekly.js             Weekly cycle calculations

data/
  assignments.json      ★ Edit this to assign villages to people
```

The two files marked ★ are the only ones you should normally need to edit.
