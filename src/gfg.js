/**
 * GFG Browser Automation
 * login → POTD → extract → screenshot-problem → set-Java → paste-code → submit → screenshot-streak
 */
const { chromium } = require('playwright');
const path  = require('path');
const fs    = require('fs-extra');
const logger = require('./logger');

const SS_DIR = path.resolve('./screenshots');
fs.ensureDirSync(SS_DIR);

class GFG {
  constructor(cfg) {
    this.cfg     = cfg;
    this.browser = null;
    this.ctx     = null;
    this.page    = null;
  }

  /* ── Browser lifecycle ─────────────────────────────────────────── */

  async launch() {
    logger.info('Launching Chromium...');
    this.browser = await chromium.launch({
      headless: this.cfg.headless !== false,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    });
    this.ctx = await this.browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-IN'
    });
    this.page = await this.ctx.newPage();
    // Suppress annoying console noise
    this.page.on('console', () => {});
    logger.info('Browser ready.');
  }

  async close() {
    if (this.browser) { await this.browser.close(); logger.info('Browser closed.'); }
  }

  /* ── Login ─────────────────────────────────────────────────────── */

  async login() {
    const { gfgEmail, gfgPassword } = this.cfg;
    logger.info(`Logging in as: ${gfgEmail}`);

    // Go to auth page directly — most reliable
    await this.page.goto('https://auth.geeksforgeeks.org/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await this._wait(2000);

    // Email
    await this._fill(['#luser', 'input[name="user"]', 'input[type="email"]',
      'input[placeholder*="Email" i]', 'input[placeholder*="username" i]'], gfgEmail);

    // Password
    await this._fill(['#password', 'input[name="pass"]', 'input[type="password"]'], gfgPassword);

    // Submit
    await this._click(['button[type="submit"]', 'input[type="submit"]',
      'button:has-text("Sign In")', 'button:has-text("Login")', '.signin-btn']);

    await this._wait(4000);
    logger.info('Login complete. URL: ' + this.page.url());
  }

  /* ── Navigate to Problem of the Day ───────────────────────────── */

  async goToPOTD() {
    logger.info('Navigating to GFG Problem of the Day...');
    await this.page.goto('https://www.geeksforgeeks.org/problem-of-the-day',
      { waitUntil: 'networkidle', timeout: 30000 });
    await this._wait(3000);

    // Try clicking on today's problem card/link
    const problemLinkSels = [
      '.problem-of-the-day a[href*="/problems/"]',
      '.potd-container a[href*="/problems/"]',
      'a.potd-banner',
      '.problems-banner a',
      'a[href*="problem-of-the-day"]'
    ];
    for (const s of problemLinkSels) {
      try {
        const el = await this.page.$(s);
        if (el) { await el.click(); await this._wait(3000); break; }
      } catch (_) {}
    }

    logger.info('POTD URL: ' + this.page.url());
  }

  /* ── Extract problem text ──────────────────────────────────────── */

  async extractProblem() {
    logger.info('Extracting problem content...');

    const data = await this.page.evaluate(() => {
      const q = (sels) => {
        for (const s of sels) {
          const el = document.querySelector(s);
          if (el?.innerText?.trim()) return el.innerText.trim();
        }
        return '';
      };

      // Collect all visible text from the problem content area
      const contentArea = document.querySelector(
        '[class*="problems_problem_content"], [class*="problem-statement"], ' +
        '[class*="problemContent"], [class*="problem_content"], main'
      );

      return {
        title: q(['.problems-heading', 'h1.ui.header', '[class*="problem-title"]',
          '[class*="problemTitle"]', '.header-title h1', 'h1']),
        difficulty: q(['[class*="difficulty"]', '.diff-tag', '[class*="Difficulty"]',
          '[class*="level"]', '.problem-difficulty']),
        statement: (contentArea?.innerText || document.body.innerText).substring(0, 5000),
        url: window.location.href,
      };
    });

    if (!data.title) data.title = 'Problem of the Day';
    if (!data.difficulty) data.difficulty = 'Medium';
    logger.info(`Problem: "${data.title}" | Difficulty: ${data.difficulty}`);
    return data;
  }

  /* ── Screenshot: problem page ──────────────────────────────────── */

  async screenshotProblem(tag) {
    const file = path.join(SS_DIR, `problem_${tag}.png`);
    await this.page.screenshot({ path: file, clip: { x: 0, y: 0, width: 1440, height: 900 } });
    logger.info('Problem screenshot: ' + path.basename(file));
    return file;
  }

  /* ── Select Java language ──────────────────────────────────────── */

  async setJava() {
    logger.info('Selecting Java language...');
    await this._wait(1000);

    // Try <select> dropdown
    const dropSels = ['select[class*="lang"]', 'select[class*="Lang"]',
      '[class*="language"] select', 'select'];
    for (const s of dropSels) {
      try {
        const opts = await this.page.$$eval(s + ' option',
          els => els.map(e => ({ val: e.value, txt: e.textContent })));
        const java = opts.find(o => /\bjava\b/i.test(o.txt) && !/javascript/i.test(o.txt));
        if (java) {
          await this.page.selectOption(s, { value: java.val });
          await this._wait(1500);
          logger.info('Java selected via <select>.');
          return;
        }
      } catch (_) {}
    }

    // Try click-based language switcher
    const btnSels = [
      'button:has-text("Java")', 'li:has-text("Java")',
      '[class*="lang"]:has-text("Java")', '[data-lang="java"]',
      '[class*="Language"]:has-text("Java")'
    ];
    for (const s of btnSels) {
      try {
        await this.page.click(s, { timeout: 3000 });
        await this._wait(1500);
        logger.info('Java selected via button/li.');
        return;
      } catch (_) {}
    }

    logger.warn('Could not switch language — proceeding with default.');
  }

  /* ── Paste code into editor ─────────────────────────────────────── */

  async pasteCode(code) {
    logger.info('Pasting solution into editor...');
    await this._wait(500);

    // Attempt 1: CodeMirror / Monaco API injection
    const injected = await this.page.evaluate((src) => {
      // CodeMirror 5
      const cm5 = document.querySelector('.CodeMirror')?.CodeMirror;
      if (cm5) { cm5.setValue(src); return 'cm5'; }

      // Monaco
      if (window.monaco) {
        const eds = window.monaco.editor.getEditors();
        if (eds.length) { eds[0].setValue(src); return 'monaco'; }
      }

      // CodeMirror 6 (dispatch)
      const cm6 = document.querySelector('.cm-editor');
      if (cm6?.cmView?.view) {
        const view = cm6.cmView.view;
        view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: src } });
        return 'cm6';
      }

      return null;
    }, code);

    if (injected) { logger.info(`Code injected via ${injected}.`); return; }

    // Attempt 2: keyboard
    const kbSels = ['.CodeMirror', '.cm-content', '.monaco-editor .inputarea',
      'textarea.ace_text-input', '[class*="editor"] textarea', 'textarea'];
    for (const s of kbSels) {
      try {
        const el = await this.page.$(s);
        if (!el) continue;
        await el.click({ force: true });
        await this.page.keyboard.press('Control+A');
        await this.page.keyboard.press('Delete');
        await this.page.keyboard.type(code, { delay: 8 });
        logger.info('Code typed via keyboard into: ' + s);
        return;
      } catch (_) {}
    }

    throw new Error('Could not find any code editor on the page.');
  }

  /* ── Submit and wait for verdict ───────────────────────────────── */

  async submit() {
    logger.info('Submitting solution...');

    const submitSels = [
      'button:has-text("Submit")', '.submit-btn', 'button[class*="submit"]',
      'button[class*="Submit"]', 'input[value="Submit"]'
    ];
    for (const s of submitSels) {
      try { await this.page.click(s, { timeout: 5000 }); break; } catch (_) {}
    }

    logger.info('Waiting for judge result (up to 70s)...');

    // Wait for any terminal verdict
    const detected = await this.page.waitForFunction(() => {
      const t = document.body.innerText || '';
      return (
        t.includes('Congratulations') || t.includes('Problem Solved') ||
        t.includes('Correct Answer') || t.includes('Wrong Answer') ||
        t.includes('Runtime Error') || t.includes('Compilation Error') ||
        t.includes('Time Limit Exceeded') || t.includes('Memory Limit') ||
        !!document.querySelector('[class*="congratulation"], [class*="correct-answer"], [class*="success-body"]')
      );
    }, { timeout: 70000 }).then(() => true).catch(() => false);

    await this._wait(2500);

    const bodyText = await this.page.evaluate(() => document.body.innerText || '');

    const correct =
      bodyText.includes('Congratulations') ||
      bodyText.includes('Problem Solved') ||
      bodyText.includes('Correct Answer');

    const wrong =
      bodyText.includes('Wrong Answer') ||
      bodyText.includes('Runtime Error') ||
      bodyText.includes('Compilation Error') ||
      bodyText.includes('Time Limit Exceeded') ||
      bodyText.includes('Memory Limit');

    logger.info(`Verdict — correct:${correct} wrong:${wrong} detected:${detected}`);
    return { correct, wrong, detected, bodyText: bodyText.substring(0, 500) };
  }

  /* ── Extract streak info from page ─────────────────────────────── */

  async getStreakInfo() {
    try {
      return await this.page.evaluate(() => {
        const t = document.body.innerText || '';
        const streakMatch = t.match(/(\d+)\s*day/i);
        const pointsMatch = t.match(/(\d+)\s*\/\s*(\d+)/);
        return {
          streak: streakMatch ? streakMatch[1] : '?',
          points: pointsMatch ? `${pointsMatch[1]}/${pointsMatch[2]}` : '?/?'
        };
      });
    } catch (_) {
      return { streak: '?', points: '?/?' };
    }
  }

  /* ── Screenshot: success/streak popup ──────────────────────────── */

  async screenshotStreak(tag) {
    const file = path.join(SS_DIR, `streak_${tag}.png`);
    await this.page.screenshot({ path: file });
    logger.info('Streak screenshot: ' + path.basename(file));
    return file;
  }

  /* ── Helpers ─────────────────────────────────────────────────────── */

  async _wait(ms) { await this.page.waitForTimeout(ms); }

  async _fill(sels, value) {
    for (const s of sels) {
      try { await this.page.fill(s, value, { timeout: 3000 }); return; } catch (_) {}
    }
    logger.warn('Could not fill any of: ' + sels.join(', '));
  }

  async _click(sels) {
    for (const s of sels) {
      try { await this.page.click(s, { timeout: 3000 }); return; } catch (_) {}
    }
    logger.warn('Could not click any of: ' + sels.join(', '));
  }
}

module.exports = GFG;
