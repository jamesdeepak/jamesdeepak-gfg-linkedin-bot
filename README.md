# 🤖 GFG LinkedIn Bot v3

> Solves GeeksforGeeks Problem of the Day in Java → Screenshots → Posts to LinkedIn. Every morning. Automatically. Zero effort.

---

## What it does (daily, automatically)

1. Logs into your GFG account
2. Opens today's Problem of the Day
3. Sends it to Claude AI → gets Java solution
4. Pastes & submits on GFG (retries up to 3 times if wrong)
5. Screenshots the problem page
6. Screenshots the streak coin popup
7. Writes a professional LinkedIn post
8. Posts both screenshots + caption to your LinkedIn

---

## Quick Start (5 steps)

### Step 1 — Install Node.js
Download from https://nodejs.org → Install the **LTS** version

### Step 2 — Double-click to start
- **Windows:** Double-click `start.bat`
- **Mac:** Right-click `start.sh` → Open With → Terminal

First launch installs everything automatically (takes ~3 minutes).

### Step 3 — Open the dashboard
Browser opens automatically at http://localhost:3000

### Step 4 — Enter credentials in Settings tab
- GFG email & password
- Anthropic API key (https://console.anthropic.com)
- LinkedIn Client ID & Secret (see LinkedIn Auth tab for guide)

### Step 5 — Connect LinkedIn & activate
- Go to **LinkedIn Auth** tab → follow the 5-step guide → click Connect
- Go to **Dashboard** → click **Start Scheduler**
- Done! Runs every day at 6 AM IST automatically

---

## Folder structure

```
gfg-linkedin-bot/
├── start.bat          ← Windows: double-click to run
├── start.sh           ← Mac/Linux: double-click to run
├── src/
│   ├── server.js      ← Express server + all API routes
│   ├── runner.js      ← Main automation pipeline
│   ├── gfg.js         ← Browser automation (Playwright)
│   ├── claude.js      ← Claude AI: solver + post writer
│   ├── linkedin.js    ← LinkedIn OAuth2 + posting
│   ├── scheduler.js   ← Daily cron job
│   ├── store.js       ← Settings persistence
│   └── logger.js      ← Log file writer
├── public/            ← Dashboard web UI
├── screenshots/       ← Auto-saved PNG files
├── logs/              ← App logs + run history
└── config/            ← Saved settings (auto-created)
```

---

## Troubleshooting

**"node is not recognized"** → Install Node.js from nodejs.org, restart computer

**GFG login fails** → Check email/password in Settings. Try unchecking "Run browser silently" to watch it happen.

**LinkedIn posts fail** → Re-authenticate in LinkedIn Auth tab

**Solution rejected 3 times** → Bot still screenshots and posts (without solution confirmation)

**Port 3000 in use** → Edit `.env`, change `PORT=3001`
