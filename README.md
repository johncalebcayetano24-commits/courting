# A Little Question for Zey 🌷

A romantic, minimalist, mobile-first web experience built with pure **HTML5, CSS3, Vanilla JavaScript**, and **Supabase** (PostgreSQL + Row Level Security + Auth), ready for static deployment on **GitHub Pages**.

Designed to feel like an intimate handwritten letter on warm cream stationery — personal, respectful, sincere, and thoughtfully crafted.

---

## Project Structure

```text
zey-courtship/
├── index.html                    # Main romantic interactive letter for Zey
├── admin.html                    # Private administrator dashboard (Supabase Auth)
├── assets/
│   ├── css/
│   │   ├── style.css             # Mobile-first romantic stationery styles
│   │   └── admin.css             # Private admin dashboard styles
│   ├── js/
│   │   ├── supabase.js           # Supabase client, validation, and data access
│   │   ├── main.js               # Interactive letter, music, petals, submission flow
│   │   └── admin.js              # Secure admin authentication & response viewer
│   ├── images/
│   │   ├── favicon.svg           # Blush tulip tab icon
│   │   ├── tulip-hero.svg        # Delicate botanical tulip illustration
│   │   ├── tulip-sprig.svg       # Pressed-tulip divider illustration
│   │   └── tulip-celebration.svg # Celebration blush tulip bouquet
│   └── music/
│       ├── romantic-piano.mp3    # Original 72 BPM instrumental felt-piano loop
│       └── AUDIO_NOTES.md        # Audio notes & custom track replacement guide
├── database/
│   └── schema.sql                # PostgreSQL schema, constraints, triggers & RLS
└── README.md
```

---

## 1. Supabase Setup Guide

### Step 1: Create a Supabase Project
1. Sign in at [supabase.com](https://supabase.com) and click **New project**.
2. Choose a project name (e.g., `zey-courtship`), set a strong database password, select a region close to you (e.g., Southeast Asia / Singapore), and create the project.

### Step 2: Run the Database Schema & RLS Policies
1. In your Supabase Dashboard, open **SQL Editor** from the left sidebar.
2. Click **New query**.
3. Copy the entire contents of `database/schema.sql` and paste it into the editor.
4. Click **Run**.

This creates:
- `public.courtship_responses` with exact column types, answer validation (`YES`, `NOT_YET`, `NO`), length/date constraints, indexes, and a server-side sanitization & timestamp trigger.
- `public.admin_users` allowlist table and `public.is_admin()` helper function.
- Strict **Row Level Security (RLS)** policies:
  - Anonymous visitors can **only `INSERT`** valid responses (they **cannot** `SELECT`, `UPDATE`, or `DELETE` any rows).
  - Only verified administrators registered in `public.admin_users` can `SELECT` responses.

### Step 3: Create Your Private Admin Account
1. In Supabase Dashboard, go to **Authentication → Providers / Sign In** (or **Authentication → Settings → User Signups**) and **disable "Allow new users to sign up"** so strangers cannot register accounts.
2. Go to **Authentication → Users → Add user → Create new user**.
3. Enter your private administrator email and a strong password, check **Auto Confirm User**, and click **Create user**.
4. Return to **SQL Editor** and register that account in `public.admin_users` (replace the email with yours):

```sql
INSERT INTO public.admin_users (user_id, email)
SELECT id, email
FROM auth.users
WHERE email = 'your-admin-email@example.com'
ON CONFLICT (user_id) DO NOTHING;
```

---

## 2. Safely Configuring Supabase Credentials

1. In Supabase Dashboard, go to **Project Settings → API** (or **API Keys**).
2. Copy:
   - **Project URL** (looks like `https://xxxxxxxxxxxx.supabase.co`)
   - **`anon` / `public` (publishable) key**
3. Open `assets/js/supabase.js` and replace the two placeholder strings at the top:

```javascript
const DEFAULT_SUPABASE_CONFIG = {
  url: "https://your-project-id.supabase.co",
  anonKey: "your-publishable-anon-key-here",
};
```

### Important Security Notes
- **NEVER put your `service_role` (secret) key in frontend code or commit it to GitHub.** The `service_role` key bypasses Row Level Security completely.
- The `anon` (publishable) key is intentionally designed to be used in browser apps like GitHub Pages. It is safe **because** `database/schema.sql` enables Row Level Security and blocks anonymous `SELECT`, `UPDATE`, and `DELETE` queries on `courtship_responses`.
- Admin authentication is handled entirely by **Supabase Auth** (`signInWithPassword`) + database-level `public.is_admin()` checks — there are no hardcoded passwords anywhere in JavaScript.

---

## 3. Romantic Piano Background Music

An original, royalty-free instrumental piano piece is included at:

`assets/music/romantic-piano.mp3`

- **Style:** Soft, warm felt piano in F major, 72 BPM, no vocals, no lyrics, no copyrighted melodies, seamlessly looped (~53 seconds, ~1.28 MB for fast mobile loading).
- **Playback behavior:**
  - Never autoplays on page load (browser-friendly & respectful).
  - Starts gently with a smooth volume fade-in only after clicking **"Open my little surprise"**.
  - Minimalist top-right music toggle button lets Zey play/pause and adjust volume anytime.
  - Continues smoothly across all screens without cutting off.
  - Remembers her play/pause and volume preference in `localStorage` and will never auto-restart after she pauses it.

### Replacing with Another Piano Recording (Optional)
If you prefer to use a live studio recording or another royalty-free track (for example from Pixabay Music, FreePD, or your own recording):
1. Export or download a soft solo piano track as `.mp3` (recommended 65–80 BPM, 128–192 kbps, under 3 MB for mobile).
2. Replace `assets/music/romantic-piano.mp3` with your file using the exact same filename.

---

## 4. Deploying to GitHub Pages

Because this project uses only static files and relative paths (`./assets/...`), deployment takes just a few minutes:

1. Create a new repository on GitHub (e.g., `zey-courtship` or a personal repo name).
2. Push the contents of the `zey-courtship/` folder to the `main` branch:

```bash
cd zey-courtship
git init
git add .
git commit -m "Initial commit: A Little Question for Zey"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git push -u origin main
```

3. On GitHub, open your repository and go to **Settings → Pages**.
4. Under **Build and deployment**:
   - **Source:** `Deploy from a branch`
   - **Branch:** `main` and folder `/ (root)`
5. Click **Save**. Within 1–2 minutes, GitHub will publish your site at:
   - **Zey's website:** `https://<your-username>.github.io/<your-repo-name>/`
   - **Your private admin dashboard:** `https://<your-username>.github.io/<your-repo-name>/admin.html`

> **Tip:** Before pushing, double-check `git diff` to confirm no `service_role` keys or private passwords were placed in any file.

---

## 5. Pre-Sharing Testing Checklist

Complete every check below before sending the link to Zey:

### Visual & Mobile Experience
- [ ] Open the deployed URL on an actual iPhone and/or Android phone.
- [ ] Confirm there is **no horizontal scrolling** on any screen.
- [ ] Confirm all text is clear, legible, and comfortably spaced.
- [ ] Confirm all buttons (`Open my little surprise`, `YES! 💗`, `NOT YET`, `NO`, `Send`) are easy to tap.
- [ ] Confirm reduced-motion mode renders cleanly without distracting animations.

### Music Controls
- [ ] Confirm music does **not** play before tapping `"Open my little surprise"`.
- [ ] Tap `"Open my little surprise"` and confirm the soft piano begins playing smoothly on mobile.
- [ ] Pause the music, navigate forward and back, and confirm it **stays paused**.
- [ ] Refresh the page and confirm your paused preference is remembered.
- [ ] Test the volume slider and confirm it adjusts volume cleanly (note: iOS Safari controls volume via hardware buttons by system design).

### Response Flows & Database Verification
- [ ] Test submitting **YES! 💗**: verify celebration animation plays, date picker works on mobile, optional personal message saves, and confirmation screen appears only after Supabase confirms success.
- [ ] Test submitting **NOT YET** (with and without optional text).
- [ ] Test submitting **NO** with an **empty** textarea to confirm she is never forced to explain her answer.
- [ ] Confirm clicking a submit button rapidly cannot create duplicate entries (submission lock + loading state works).

### Security & Admin Dashboard
- [ ] Open `/admin.html` in a private/incognito tab and confirm responses are **not** visible before signing in.
- [ ] Test logging in with a wrong password and confirm access is rejected cleanly.
- [ ] Log in with your Supabase administrator email + password and confirm all test submissions display: her name, answer, exact submission date/time, selected courtship date (when `YES`), and optional message/reason.
- [ ] Click **Log Out** and verify the dashboard clears immediately and returns to the login screen.
- [ ] Verify anonymous read protection: confirm anonymous visitors cannot read `courtship_responses` from the browser console or REST API.

### Clean Up Test Entries Before Sharing
After verifying everything works, delete your own test rows from Supabase **SQL Editor** so the table starts fresh for Zey:

```sql
DELETE FROM public.courtship_responses;
```

You are ready to share the link with Zey. Wishing you both something sincere and wonderful. 🌷
