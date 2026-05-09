/* ═══════════════════════════════════════════════
   GFG LinkedIn Bot v3 — Frontend Application
   ═══════════════════════════════════════════════ */
'use strict';

/* ── API ──────────────────────────────────────── */
const api = {
  async get(u) {
    const r = await fetch(u);
    if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText); }
    return r.json();
  },
  async post(u, d = {}) {
    const r = await fetch(u, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(d) });
    if (!r.ok) { const t = await r.text(); throw new Error(t || r.statusText); }
    return r.json();
  }
};

/* ── Navigation ───────────────────────────────── */
document.querySelectorAll('.nl').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const pg = link.dataset.p;
    document.querySelectorAll('.nl').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    link.classList.add('active');
    const el = document.getElementById('page-' + pg);
    if (el) el.classList.add('active');
    if (pg === 'history') loadHistory();
    if (pg === 'logs')    loadLogs();
    if (pg === 'linkedin') loadLiStatus();
    if (pg === 'settings') loadSettings();
  });
});

/* ── Toast ────────────────────────────────────── */
function toast(msg, type = '', ms = 3500) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast show ' + type;
  clearTimeout(el._tid);
  el._tid = setTimeout(() => el.classList.remove('show'), ms);
}

/* ── Modal ────────────────────────────────────── */
function showModal(title, html) {
  document.getElementById('mTitle').textContent = title;
  document.getElementById('mBody').innerHTML = html;
  document.getElementById('modalOv').style.display = 'flex';
}

/* ── Escape HTML ──────────────────────────────── */
const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

/* ── Cron → human ─────────────────────────────── */
function cronHuman(expr) {
  if (!expr) return '';
  const p = expr.trim().split(/\s+/);
  if (p.length !== 5) return expr;
  const [min, hr, dom, mon, dow] = p;
  if (dom === '*' && mon === '*' && dow === '*' && hr !== '*') {
    const h = hr.padStart(2,'0');
    const m = (min === '0' ? '00' : String(min).padStart(2,'0'));
    return `Every day at ${h}:${m}`;
  }
  return expr;
}
function upCron() {
  const v = document.getElementById('cCron')?.value || '';
  const el = document.getElementById('cronPrev');
  if (el) el.textContent = cronHuman(v);
}

/* ── Toggle password ──────────────────────────── */
function tp(id) {
  const el = document.getElementById(id);
  if (el) el.type = el.type === 'password' ? 'text' : 'password';
}

/* ── Diff badge class ─────────────────────────── */
function diffCls(d) {
  if (!d) return '';
  const l = d.toLowerCase();
  return l === 'easy' ? 'gn-b' : l === 'medium' ? 'or-b' : l === 'hard' ? 'rd-b' : '';
}

// ════════════════════════════════════════════════
//  DASHBOARD
// ════════════════════════════════════════════════

async function loadStats() {
  try {
    const d = await api.get('/api/stats');

    set('sS', d.streak ?? '—');
    set('sR', d.runsMonth ?? '—');
    set('sP', d.posts ?? '—');
    set('sQ', (typeof d.successRate === 'number' ? d.successRate + '%' : '—'));

    // Scheduler pill
    const pill = document.getElementById('schedPill');
    if (pill) {
      if (d.schedulerActive) {
        pill.classList.add('on');
        pill.querySelector('.slbl').textContent = 'Scheduler Active';
      } else {
        pill.classList.remove('on');
        pill.querySelector('.slbl').textContent = 'Scheduler Off';
      }
    }

    // Cron display
    const cfg = await api.get('/api/config');
    set('cronBig', cfg.cronSchedule || '0 6 * * *');
    set('cronSm',  cronHuman(cfg.cronSchedule || '0 6 * * *'));
    set('tzLbl',   cfg.timezone || 'Asia/Kolkata');

    if (d.lastRun) renderLastRun(d.lastRun);
    if (d.screenshots?.length) renderScreenshots(d.screenshots);
  } catch (e) { console.warn('Stats:', e); }
}

function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }

function renderLastRun(r) {
  const badge = document.getElementById('lastBadge');
  if (badge) {
    badge.textContent = r.success ? 'Success' : r.error ? 'Failed' : 'Partial';
    badge.className = 'badge ' + (r.success ? 'gn-b' : r.error ? 'rd-b' : 'or-b');
  }
  const body = document.getElementById('lastBody');
  if (!body) return;
  body.innerHTML = `
    <div class="rr"><strong>Problem</strong>${esc(r.title || '—')}</div>
    <div class="rr"><strong>Difficulty</strong><span class="badge ${diffCls(r.difficulty)}">${esc(r.difficulty || '—')}</span></div>
    <div class="rr"><strong>Streak</strong>🔥 ${esc(r.streak || '—')} days</div>
    <div class="rr"><strong>Attempts</strong>${esc(r.attempts || '—')}/3</div>
    <div class="rr"><strong>Duration</strong>${esc(r.durationSec || '—')}s</div>
    <div class="rr"><strong>Time</strong>${r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</div>
    ${r.linkedInPostId ? `<div class="rr"><strong>LinkedIn</strong><span style="color:var(--gn)">✓ Published</span></div>` : ''}
    ${r.error ? `<div class="rr"><strong>Error</strong><span style="color:var(--rd);font-size:12px">${esc(r.error)}</span></div>` : ''}
  `;
}

function renderScreenshots(list) {
  const grid = document.getElementById('ssGrid');
  if (!grid) return;
  grid.innerHTML = list.map(s => `
    <div class="ss-item">
      <img src="${s.url}" alt="${esc(s.name)}" loading="lazy" onclick="window.open('${s.url}','_blank')"/>
      <div class="ss-cap">${esc(s.name)}</div>
    </div>`).join('');
}

/* ── Run Now ──────────────────────────────────── */
let _running = false;
let _pollTimer = null;
let _knownSteps = 0;

document.getElementById('btnRun')?.addEventListener('click', async () => {
  if (_running) { toast('Already running — please wait!', 'wrn'); return; }

  if (!confirm(
    'Start automation now?\n\n' +
    'This will:\n' +
    '  1. Log into GeeksforGeeks\n' +
    '  2. Read today\'s Problem of the Day\n' +
    '  3. Solve it in Java (up to 3 tries)\n' +
    '  4. Post to LinkedIn with screenshots\n\n' +
    'Continue?'
  )) return;

  _running = true;
  _knownSteps = 0;

  const btn = document.getElementById('btnRun');
  btn.disabled = true;
  btn.innerHTML = '⏳ Running…';

  // Show terminal
  const tb = document.getElementById('termBody');
  const tw = document.getElementById('termBox');
  if (tw) tw.style.display = 'block';
  if (tb) tb.innerHTML = '';
  addTLine('▶', 'Starting pipeline…', '');

  try {
    const resp = await api.post('/api/run');
    if (!resp.started) throw new Error(resp.error || 'Failed to start');
  } catch (e) {
    toast('❌ ' + e.message, 'err', 7000);
    _finishRun();
    return;
  }

  // Poll every 1.5s
  _pollTimer = setInterval(_pollProgress, 1500);
  // Hard cutoff 12 min
  setTimeout(() => { if (_running) _finishRun(); }, 720000);
});

async function _pollProgress() {
  try {
    const p = await api.get('/api/progress');

    // Render new steps
    if (p.steps?.length > _knownSteps) {
      for (let i = _knownSteps; i < p.steps.length; i++) {
        const s = p.steps[i];
        const cls = s.status === 'done' ? 'done' : s.status === 'error' ? 'err' : s.status === 'warn' ? 'warn' : '';
        addTLine(s.step, s.msg, cls);
      }
      _knownSteps = p.steps.length;
    }

    if (!p.running) _finishRun(p.lastResult);
  } catch (e) { console.warn('Poll error:', e); }
}

function addTLine(step, msg, cls) {
  const tb = document.getElementById('termBody');
  if (!tb) return;
  const now = new Date().toLocaleTimeString('en-GB', { hour12:false });
  const d = document.createElement('div');
  d.className = 'tl ' + (cls || '');
  d.innerHTML = `<span class="tl-t">${now}</span><span class="tl-s">[${esc(step)}]</span><span class="tl-m">${esc(msg)}</span>`;
  tb.appendChild(d);
  tb.scrollTop = tb.scrollHeight;
}

function _finishRun(result) {
  clearInterval(_pollTimer);
  _running = false;
  _knownSteps = 0;

  const badge = document.getElementById('termBadge');
  if (badge) { badge.textContent = '● DONE'; badge.style.animation = 'none'; badge.style.color = 'var(--gn)'; }

  const btn = document.getElementById('btnRun');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = '<svg viewBox="0 0 20 20" fill="currentColor" width="15"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg> Run Now';
  }

  if (result?.success) {
    toast('✅ Done! Problem solved and posted to LinkedIn.', 'ok', 5000);
    showModal('🎉 Run Complete!', `
      <div class="rb"><h4>✅ Problem Solved</h4>
        <p style="font-size:14px;font-weight:700">${esc(result.problem?.title || result.title || '—')}</p>
        <p style="color:var(--mu);margin-top:4px">${esc(result.problem?.difficulty || result.difficulty || '—')} · ${esc(result.attempts || '?')}/3 attempts</p>
        <p style="color:var(--gn);margin-top:6px;font-size:15px">🔥 ${esc(result.streakInfo?.streak || result.streak || '?')} day streak</p>
      </div>
      ${result.post ? `<div class="rb"><h4>LinkedIn Post</h4><div class="post-v">${esc(result.post)}</div></div>` : ''}
      ${result.linkedInPostId ? `<p style="color:var(--gn);font-size:13px;margin-top:4px">✓ Posted! ID: ${esc(result.linkedInPostId)}</p>` : ''}
    `);
  } else if (result?.error) {
    toast('❌ Failed: ' + result.error, 'err', 7000);
  } else if (result) {
    toast('⚠️ Partial run — check logs for details.', 'wrn', 5000);
  }

  loadStats();
}

/* ── Scheduler ────────────────────────────────── */
let _schedOn = false;
document.getElementById('btnSched')?.addEventListener('click', async () => {
  try {
    if (_schedOn) {
      await api.post('/api/scheduler/stop');
      _schedOn = false;
      document.getElementById('btnSched').textContent = '▶ Start Scheduler';
      toast('Scheduler stopped.', '');
    } else {
      await api.post('/api/scheduler/start');
      _schedOn = true;
      document.getElementById('btnSched').textContent = '⏹ Stop Scheduler';
      toast('✅ Scheduler started! Runs daily at your set time.', 'ok');
    }
    await loadStats();
  } catch (e) { toast('Error: ' + e.message, 'err'); }
});

// ════════════════════════════════════════════════
//  SETTINGS
// ════════════════════════════════════════════════

async function loadSettings() {
  try {
    const c = await api.get('/api/config');
    if (c.gfgEmail) _val('cEmail', c.gfgEmail);
    if (c.hasGfgPassword) _val('cPass', '••••••••');
    if (c.hasAnthropicKey) _val('cAnth', '••••••••');
    if (c.liClientId) _val('cLiId', c.liClientId);
    if (c.hasLiClientSecret) _val('cLiSec', '••••••••');
    _val('cCron', c.cronSchedule || '0 6 * * *');
    _sel('cTz', c.timezone || 'Asia/Kolkata');
    const hEl = document.getElementById('cHead');
    if (hEl) hEl.checked = c.headless !== false;

    // Status indicators
    _status('gfgStatus', c.gfgEmail && c.hasGfgPassword, 'GFG credentials saved ✓', 'Not configured yet');
    _status('anthStatus', c.hasAnthropicKey, 'API key saved ✓', 'Not configured yet');
    _status('liStatus', c.liClientId && c.hasLiClientSecret, 'LinkedIn app credentials saved ✓', 'Not configured yet');

    upCron();
  } catch (e) { console.warn('loadSettings:', e); }
}

function _val(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function _sel(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
function _status(id, ok, yes, no) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = ok ? yes : no;
  el.style.color = ok ? 'var(--gn)' : 'var(--mu)';
}

document.getElementById('btnSave')?.addEventListener('click', async () => {
  const btn = document.getElementById('btnSave');
  btn.disabled = true; btn.textContent = '💾 Saving…';
  try {
    const gfgPass  = document.getElementById('cPass')?.value;
    const anthKey  = document.getElementById('cAnth')?.value;
    const liSecret = document.getElementById('cLiSec')?.value;

    await api.post('/api/config', {
      gfgEmail:       document.getElementById('cEmail')?.value.trim(),
      gfgPassword:    (gfgPass && gfgPass !== '••••••••') ? gfgPass : undefined,
      anthropicKey:   (anthKey && anthKey !== '••••••••') ? anthKey.trim() : undefined,
      liClientId:     document.getElementById('cLiId')?.value.trim(),
      liClientSecret: (liSecret && liSecret !== '••••••••') ? liSecret : undefined,
      cronSchedule:   document.getElementById('cCron')?.value.trim(),
      timezone:       document.getElementById('cTz')?.value,
      headless:       document.getElementById('cHead')?.checked
    });

    const msg = document.getElementById('saveMsg');
    if (msg) { msg.textContent = '✓ All settings saved!'; setTimeout(() => msg.textContent = '', 3500); }
    toast('✅ Settings saved!', 'ok');
    await loadSettings();
    await loadStats();
  } catch (e) {
    toast('❌ Error saving: ' + e.message, 'err');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Save All Settings';
  }
});

// ════════════════════════════════════════════════
//  LINKEDIN AUTH
// ════════════════════════════════════════════════

async function loadLiStatus() {
  try {
    const s = await api.get('/api/linkedin/status');

    const checks = { ck1: s.hasClientId, ck2: s.hasClientSecret, ck3: s.hasToken, ck4: s.hasUrn };
    for (const [id, ok] of Object.entries(checks)) {
      const el = document.getElementById(id);
      if (el) el.className = ok ? 'ok' : '';
    }

    const ico   = document.getElementById('authIco');
    const title = document.getElementById('authTitle');
    const desc  = document.getElementById('authDesc');
    const urn   = document.getElementById('authUrn');
    const conn  = document.getElementById('btnConn');
    const disc  = document.getElementById('btnDisconn');

    if (s.authenticated) {
      if (ico)   ico.textContent   = '🔓';
      if (title) title.textContent = 'Connected!';
      if (desc)  desc.textContent  = 'Your LinkedIn account is linked. Posts will go live automatically.';
      if (urn)  { urn.style.display = 'block'; urn.textContent = s.personUrn; }
      if (conn)  conn.style.display = 'none';
      if (disc)  disc.style.display = 'inline-flex';
    } else {
      if (ico)   ico.textContent   = '🔒';
      if (title) title.textContent = 'Not Connected';
      if (desc)  desc.textContent  = 'Complete the steps below and click Connect.';
      if (urn)   urn.style.display = 'none';
      if (conn)  conn.style.display = 'inline-flex';
      if (disc)  disc.style.display = 'none';
    }
  } catch (e) { console.warn('loadLiStatus:', e); }
}

document.getElementById('btnConn')?.addEventListener('click', async () => {
  try {
    const d = await api.get('/api/linkedin/authurl');
    if (!d.url) { toast('⚠️ Set LinkedIn Client ID and Secret in Settings first!', 'wrn', 6000); return; }

    window.open(d.url, '_blank', 'width=640,height=720,scrollbars=yes');
    toast('Complete the LinkedIn authorization in the popup window…', '', 8000);

    // Poll until connected
    let tries = 0;
    const poll = setInterval(async () => {
      tries++;
      const s = await api.get('/api/linkedin/status').catch(() => null);
      if (s?.authenticated || tries > 60) {
        clearInterval(poll);
        if (s?.authenticated) { toast('✅ LinkedIn connected!', 'ok'); loadLiStatus(); }
      }
    }, 3000);
  } catch (e) { toast('Error: ' + e.message, 'err'); }
});

document.getElementById('btnDisconn')?.addEventListener('click', async () => {
  if (!confirm('Disconnect LinkedIn account?')) return;
  await api.post('/api/linkedin/disconnect');
  toast('LinkedIn disconnected.', '');
  loadLiStatus();
});

// ════════════════════════════════════════════════
//  HISTORY
// ════════════════════════════════════════════════

async function loadHistory() {
  try {
    const rows = await api.get('/api/history');
    const tbody = document.getElementById('histBody');
    if (!tbody) return;

    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="dim tc pad">No history yet — run the bot first!</td></tr>';
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td class="mono-s">${r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</td>
        <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(r.title)}">${esc(r.title || '—')}</td>
        <td><span class="badge ${diffCls(r.difficulty)}">${esc(r.difficulty || '—')}</span></td>
        <td>🔥 ${esc(r.streak || '—')}</td>
        <td class="mono-s" style="text-align:center">${esc(r.attempts || '—')}/3</td>
        <td>${r.linkedInPostId ? `<span class="badge gn-b">✓ Posted</span>` : `<span class="badge">—</span>`}</td>
        <td>${r.success ? `<span class="badge gn-b">✓ Passed</span>` : `<span class="badge rd-b">✗ Failed</span>`}</td>
      </tr>`).join('');
  } catch (e) { console.warn('loadHistory:', e); }
}

// ════════════════════════════════════════════════
//  LOGS
// ════════════════════════════════════════════════

async function loadLogs() {
  try {
    const d = await api.get('/api/logs');
    const body = document.getElementById('logBody');
    if (!body) return;
    if (!d.lines?.length) { body.innerHTML = '<p class="dim">No logs yet.</p>'; return; }
    body.innerHTML = d.lines.map(line => {
      const cls = /\[ERROR\]/i.test(line) ? 'li-e' : /\[WARN\]/i.test(line) ? 'li-w' : 'li-i';
      return `<div class="ll ${cls}">${esc(line)}</div>`;
    }).join('');
  } catch (e) { console.warn('loadLogs:', e); }
}

// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', async () => {
  await loadStats();
  await loadSettings();
  upCron();
  // Sync scheduler button state
  const status = await api.get('/api/scheduler/status').catch(() => ({ active: false }));
  _schedOn = status.active;
  const btn = document.getElementById('btnSched');
  if (btn) btn.textContent = _schedOn ? '⏹ Stop Scheduler' : '▶ Start Scheduler';

  // Refresh stats every 30s
  setInterval(loadStats, 30000);
});
