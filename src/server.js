/**
 * GFG LinkedIn Bot — Express API Server
 * All API routes + LinkedIn OAuth callback + static file serving
 */
require('dotenv').config();
const express   = require('express');
const path      = require('path');
const fs        = require('fs-extra');

const logger    = require('./logger');
const store     = require('./store');
const scheduler = require('./scheduler');
const { run }   = require('./runner');
const LinkedIn  = require('./linkedin');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/screenshots', express.static(path.resolve('./screenshots')));

// ── Live progress state ───────────────────────────────────────────
let _liveSteps   = [];
let _liveRunning = false;
let _lastResult  = null;

function emit(evt) {
  _liveSteps.push({ ...evt, ts: new Date().toISOString() });
}
scheduler.setEmitter(emit);

// ═════════════════════════════════════════════════════════════════
//  API ROUTES
// ═════════════════════════════════════════════════════════════════

/* ── Config GET ── */
app.get('/api/config', (req, res) => {
  const s = store.load();
  res.json({
    gfgEmail:       s.gfgEmail,
    hasGfgPassword: !!s.gfgPassword,
    hasAnthropicKey: !!s.anthropicKey,
    liClientId:     s.liClientId,
    hasLiClientSecret: !!s.liClientSecret,
    cronSchedule:   s.cronSchedule,
    timezone:       s.timezone,
    headless:       s.headless,
    schedulerEnabled: s.schedulerEnabled
  });
});

/* ── Config POST ── */
app.post('/api/config', (req, res) => {
  try {
    const b = req.body;
    const updates = {};
    // Only update fields that are explicitly provided and non-empty
    if (b.gfgEmail      !== undefined) updates.gfgEmail      = b.gfgEmail.trim();
    if (b.gfgPassword   && b.gfgPassword !== '••••••••') updates.gfgPassword   = b.gfgPassword;
    if (b.anthropicKey  && !b.anthropicKey.includes('…'))   updates.anthropicKey  = b.anthropicKey.trim();
    if (b.liClientId    !== undefined) updates.liClientId    = b.liClientId.trim();
    if (b.liClientSecret && b.liClientSecret !== '••••••••') updates.liClientSecret = b.liClientSecret;
    if (b.cronSchedule  !== undefined) updates.cronSchedule  = b.cronSchedule.trim();
    if (b.timezone      !== undefined) updates.timezone      = b.timezone;
    if (b.headless      !== undefined) updates.headless      = b.headless;
    store.save(updates);
    res.json({ ok: true });
  } catch (e) {
    logger.error('Config save error: ' + e.message);
    res.status(500).json({ error: e.message });
  }
});

/* ── Stats ── */
app.get('/api/stats', (req, res) => {
  try {
    const histFile = path.resolve('./logs/history.json');
    const history  = fs.existsSync(histFile) ? fs.readJsonSync(histFile) : [];

    const now = new Date();
    const thisMonth = history.filter(r => {
      if (!r.startedAt) return false;
      const d = new Date(r.startedAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    const total       = history.length;
    const successCount = history.filter(r => r.success).length;
    const postCount    = history.filter(r => r.linkedInPostId).length;
    const successRate  = total ? Math.round((successCount / total) * 100) : 0;
    const latestStreak = history.find(r => r.streak && r.streak !== '?')?.streak || '—';

    // Recent screenshots (latest 6)
    const ssDir  = path.resolve('./screenshots');
    const screenshots = [];
    if (fs.existsSync(ssDir)) {
      fs.readdirSync(ssDir)
        .filter(f => f.endsWith('.png'))
        .sort().reverse().slice(0, 6)
        .forEach(f => screenshots.push({ name: f, url: `/screenshots/${encodeURIComponent(f)}` }));
    }

    res.json({
      streak:          latestStreak,
      runsMonth:       thisMonth.length,
      posts:           postCount,
      successRate,
      totalRuns:       total,
      schedulerActive: scheduler.status().active,
      schedulerRunning: scheduler.isRunning(),
      lastRun:         history[0] || null,
      screenshots
    });
  } catch (e) {
    res.json({ streak: '—', runsMonth: 0, posts: 0, successRate: 0, screenshots: [] });
  }
});

/* ── Run Now ── */
app.post('/api/run', async (req, res) => {
  if (_liveRunning || scheduler.isRunning()) {
    return res.status(409).json({ error: 'Already running. Please wait for it to finish.' });
  }

  const cfg = store.load();
  if (!cfg.gfgEmail || !cfg.gfgPassword)
    return res.status(400).json({ error: 'GFG email and password not set. Go to ⚙ Settings.' });
  if (!cfg.anthropicKey)
    return res.status(400).json({ error: 'Anthropic API key not set. Go to ⚙ Settings.' });

  // Reset live state
  _liveSteps   = [];
  _liveRunning = true;
  _lastResult  = null;

  // Respond immediately so UI can start polling
  res.json({ started: true });

  // Run asynchronously
  try {
    const result = await run(emit);
    _lastResult  = result;
  } catch (e) {
    _lastResult = { success: false, error: e.message };
  } finally {
    _liveRunning = false;
  }
});

/* ── Progress polling ── */
app.get('/api/progress', (req, res) => {
  res.json({
    running:    _liveRunning || scheduler.isRunning(),
    steps:      _liveSteps,
    lastResult: _lastResult
  });
});

/* ── Scheduler ── */
app.post('/api/scheduler/start', (req, res) => {
  try { const info = scheduler.start(); res.json({ ok: true, ...info }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/scheduler/stop', (req, res) => {
  scheduler.stop(); res.json({ ok: true });
});

app.get('/api/scheduler/status', (req, res) => res.json(scheduler.status()));

/* ── History ── */
app.get('/api/history', (req, res) => {
  const f = path.resolve('./logs/history.json');
  res.json(fs.existsSync(f) ? fs.readJsonSync(f) : []);
});

/* ── Logs ── */
app.get('/api/logs', (req, res) => {
  const f = path.resolve('./logs/app.log');
  if (!fs.existsSync(f)) return res.json({ lines: [] });
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n').slice(-400).reverse();
  res.json({ lines });
});

/* ── LinkedIn status ── */
app.get('/api/linkedin/status', (req, res) => {
  const s = store.load();
  res.json({
    hasClientId:     !!s.liClientId,
    hasClientSecret: !!s.liClientSecret,
    hasToken:        !!s.liAccessToken,
    hasUrn:          !!s.liPersonUrn,
    authenticated:   !!(s.liAccessToken && s.liPersonUrn),
    personUrn:       s.liPersonUrn || null
  });
});

/* ── LinkedIn auth URL ── */
app.get('/api/linkedin/authurl', (req, res) => {
  const s  = store.load();
  const li = new LinkedIn(s);
  res.json({ url: li.getAuthUrl() });
});

/* ── LinkedIn OAuth callback ── */
app.get('/auth/linkedin/callback', async (req, res) => {
  const { code, error } = req.query;

  const page = (icon, title, body, extra = '') => `<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:'Outfit',sans-serif;background:#07090f;color:#dde4f0;display:flex;align-items:center;justify-content:center;min-height:100vh}
  .box{text-align:center;padding:48px 40px;background:#0c1018;border-radius:16px;border:1px solid rgba(255,255,255,.08);max-width:460px;width:90%}
  .ico{font-size:60px;margin-bottom:16px}
  h2{font-size:22px;font-weight:800;margin-bottom:10px}
  p{color:#607080;font-size:14px;line-height:1.7;margin-bottom:6px}
  .urn{margin-top:12px;padding:10px 14px;background:#111827;border-radius:8px;font-family:monospace;font-size:12px;color:#00e676;word-break:break-all}
  .btn{display:inline-block;margin-top:22px;padding:11px 28px;background:#00e676;color:#000;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer;border:none}
</style></head>
<body><div class="box">
  <div class="ico">${icon}</div>
  <h2>${title}</h2>
  <p>${body}</p>
  ${extra}
  <button class="btn" onclick="window.close()">Close Window</button>
</div></body></html>`;

  if (error) return res.send(page('❌', 'Authorization Failed', error));
  if (!code)  return res.send(page('❌', 'No Code Received', 'LinkedIn did not return an authorization code.'));

  try {
    const cfg = store.load();
    const li  = new LinkedIn(cfg);
    await li.exchangeCode(code);
    await li.fetchPersonUrn();
    store.save({ liAccessToken: li.accessToken, liPersonUrn: li.personUrn });
    logger.info('✅ LinkedIn authenticated: ' + li.personUrn);
    res.send(page(
      '🎉', 'LinkedIn Connected!',
      'Your account is now linked. The bot will post automatically every day.',
      `<div class="urn">${li.personUrn}</div>`
    ));
  } catch (e) {
    logger.error('LinkedIn callback error: ' + e.message);
    res.send(page('❌', 'Connection Failed', e.message));
  }
});

/* ── LinkedIn disconnect ── */
app.post('/api/linkedin/disconnect', (req, res) => {
  store.save({ liAccessToken: '', liPersonUrn: '' });
  res.json({ ok: true });
});

/* ── Health ── */
app.get('/api/health', (req, res) =>
  res.json({ ok: true, uptime: Math.round(process.uptime()) + 's', version: '3.0.0' }));

/* ── SPA fallback ── */
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, '../public/index.html')));

// ── Start ─────────────────────────────────────────────────────────
app.listen(PORT, () => {
  logger.info(`🚀 GFG Bot v3 running at http://localhost:${PORT}`);

  // Auto-resume scheduler if it was active before restart
  const cfg = store.load();
  if (cfg.schedulerEnabled && cfg.gfgEmail && cfg.anthropicKey) {
    try { scheduler.start(); logger.info('✅ Scheduler auto-resumed.'); }
    catch (e) { logger.warn('Could not auto-resume scheduler: ' + e.message); }
  }
});
