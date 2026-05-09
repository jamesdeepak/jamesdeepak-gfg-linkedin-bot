/**
 * Main Automation Runner
 *
 * Pipeline:
 *  1  Launch browser + login GFG
 *  2  Navigate to Problem of the Day
 *  3  Extract problem text
 *  4  Screenshot problem page
 *  5  Select Java language
 *  6─8 Solve with Claude AI → paste → submit  (up to 3 retries)
 *  9  Get streak info
 * 10  Screenshot streak/coin popup
 * 11  Generate LinkedIn post (motivational student voice)
 * 12  Upload both screenshots + post to LinkedIn
 */

const path  = require('path');
const fs    = require('fs-extra');
const { v4: uuid } = require('uuid');
const GFG      = require('./gfg');
const LinkedIn = require('./linkedin');
const { solveProblem, generatePost } = require('./claude');
const logger   = require('./logger');
const store    = require('./store');

const HISTORY_FILE = path.resolve('./logs/history.json');

/**
 * @param {Function} emit  fn({ step, msg, status }) for live dashboard updates
 * @returns {Object} run result record
 */
async function run(emit = () => {}) {
  const cfg   = store.load();
  const runId = uuid().slice(0, 8);
  const tag   = new Date().toISOString().slice(0, 10) + '_' + runId;
  const t0    = Date.now();

  const rec = {
    runId, tag,
    startedAt: new Date().toISOString(),
    success: false,
    problem: null,
    streakInfo: null,
    solution: null,
    post: null,
    linkedInPostId: null,
    screenshots: { problem: null, streak: null },
    attempts: 0,
    error: null,
    durationSec: 0
  };

  function step(n, msg, status = 'running') {
    logger.info(`[Step ${n}] ${msg}`);
    emit({ step: n, msg, status });
  }

  const gfg = new GFG(cfg);

  try {
    /* ── 1. Launch + Login ── */
    step(1, 'Launching browser and logging into GeeksforGeeks...');
    await gfg.launch();
    await gfg.login();

    /* ── 2. Navigate POTD ── */
    step(2, 'Opening the Problem of the Day...');
    await gfg.goToPOTD();

    /* ── 3. Extract problem ── */
    step(3, 'Reading the problem statement...');
    const problem = await gfg.extractProblem();
    rec.problem = problem;

    /* ── 4. Screenshot problem ── */
    step(4, `Screenshotting problem: "${problem.title}"`);
    rec.screenshots.problem = await gfg.screenshotProblem(tag);

    /* ── 5. Set Java ── */
    step(5, 'Selecting Java as the programming language...');
    await gfg.setJava();

    /* ── 6–8. Solve → Paste → Submit (up to 3 attempts) ── */
    let passed = false;

    for (let attempt = 1; attempt <= 3; attempt++) {
      rec.attempts = attempt;

      step(6, `Claude AI generating Java solution (attempt ${attempt}/3)...`);
      let code;
      try {
        code = await solveProblem(cfg.anthropicKey, problem, attempt);
        rec.solution = code;
      } catch (e) {
        step(6, `Claude API error: ${e.message}`, 'error');
        throw new Error('Claude AI failed: ' + e.message);
      }

      step(7, `Pasting solution into editor (attempt ${attempt}/3)...`);
      await gfg.pasteCode(code);

      step(8, `Submitting to GeeksforGeeks (attempt ${attempt}/3)...`);
      const verdict = await gfg.submit();

      if (verdict.correct) {
        passed = true;
        step(8, `✅ Solution ACCEPTED on attempt ${attempt}!`, 'done');
        break;
      }

      if (attempt < 3) {
        const reason = verdict.wrong
          ? `Attempt ${attempt} — Wrong Answer. Retrying with different approach...`
          : `Attempt ${attempt} — No clear verdict. Retrying...`;
        step(8, reason, 'warn');
        await gfg.page.waitForTimeout(2000);
      } else {
        step(8, `All 3 attempts done. ${verdict.wrong ? 'Answers were wrong' : 'Could not confirm'}. Continuing...`, 'warn');
      }
    }

    /* ── 9. Streak info ── */
    step(9, 'Reading streak information...');
    const streakInfo = await gfg.getStreakInfo();
    rec.streakInfo = streakInfo;
    step(9, `🔥 Streak: ${streakInfo.streak} days | Points: ${streakInfo.points}`, 'done');

    /* ── 10. Screenshot streak popup ── */
    step(10, 'Screenshotting the streak coin popup...');
    rec.screenshots.streak = await gfg.screenshotStreak(tag);

    /* ── 11. Generate LinkedIn post ── */
    step(11, 'Claude AI writing LinkedIn post (student voice)...');
    const post = await generatePost(cfg.anthropicKey, problem, streakInfo);
    rec.post = post;

    /* ── 12. Post to LinkedIn ── */
    const li = new LinkedIn(cfg);
    if (li.isAuthenticated()) {
      step(12, 'Uploading screenshots and posting to LinkedIn...');
      const images = [rec.screenshots.problem, rec.screenshots.streak].filter(Boolean);
      const postId = await li.post(post, images);
      rec.linkedInPostId = postId;
      step(12, `✅ Posted to LinkedIn! Post ID: ${postId}`, 'done');
    } else {
      step(12, '⚠️ LinkedIn not connected — post skipped. Go to LinkedIn Auth tab.', 'warn');
    }

    rec.success = passed;

  } catch (err) {
    rec.error = err.message;
    logger.error('Run failed: ' + err.stack);
    step('❌', 'Run failed: ' + err.message, 'error');
  } finally {
    await gfg.close();
    rec.durationSec = Math.round((Date.now() - t0) / 1000);
    _saveHistory(rec);
    logger.info(`Run ${rec.runId} finished in ${rec.durationSec}s — success: ${rec.success}`);
  }

  return rec;
}

function _saveHistory(rec) {
  try {
    fs.ensureDirSync(path.dirname(HISTORY_FILE));
    let h = fs.existsSync(HISTORY_FILE) ? fs.readJsonSync(HISTORY_FILE) : [];
    h.unshift({
      runId:         rec.runId,
      startedAt:     rec.startedAt,
      success:       rec.success,
      title:         rec.problem?.title      || '—',
      difficulty:    rec.problem?.difficulty || '—',
      streak:        rec.streakInfo?.streak  || '—',
      points:        rec.streakInfo?.points  || '—',
      attempts:      rec.attempts,
      linkedInPostId: rec.linkedInPostId,
      durationSec:   rec.durationSec,
      error:         rec.error
    });
    if (h.length > 90) h = h.slice(0, 90);
    fs.writeJsonSync(HISTORY_FILE, h, { spaces: 2 });
  } catch (e) { logger.warn('Could not save history: ' + e.message); }
}

module.exports = { run };
