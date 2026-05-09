/**
 * Persistent settings store.
 * Values come from .env on startup, then from config/settings.json
 * when saved via the dashboard. Writing to .env keeps things portable.
 */
require('dotenv').config();
const fs   = require('fs-extra');
const path = require('path');

const SETTINGS_FILE = path.resolve('./config/settings.json');
const ENV_FILE      = path.resolve('./.env');

// Keys we persist (in both JSON and .env)
const ENV_MAP = {
  gfgEmail:        'GFG_EMAIL',
  gfgPassword:     'GFG_PASSWORD',
  anthropicKey:    'ANTHROPIC_API_KEY',
  liClientId:      'LINKEDIN_CLIENT_ID',
  liClientSecret:  'LINKEDIN_CLIENT_SECRET',
  liRedirectUri:   'LINKEDIN_REDIRECT_URI',
  liAccessToken:   'LINKEDIN_ACCESS_TOKEN',
  liPersonUrn:     'LINKEDIN_PERSON_URN',
  cronSchedule:    'CRON_SCHEDULE',
  timezone:        'TIMEZONE',
};

const DEFAULTS = {
  gfgEmail:       process.env.GFG_EMAIL        || '',
  gfgPassword:    process.env.GFG_PASSWORD      || '',
  anthropicKey:   process.env.ANTHROPIC_API_KEY || '',
  liClientId:     process.env.LINKEDIN_CLIENT_ID     || '',
  liClientSecret: process.env.LINKEDIN_CLIENT_SECRET || '',
  liRedirectUri:  process.env.LINKEDIN_REDIRECT_URI  || 'http://localhost:3000/auth/linkedin/callback',
  liAccessToken:  process.env.LINKEDIN_ACCESS_TOKEN  || '',
  liPersonUrn:    process.env.LINKEDIN_PERSON_URN    || '',
  cronSchedule:   process.env.CRON_SCHEDULE || '0 6 * * *',
  timezone:       process.env.TIMEZONE      || 'Asia/Kolkata',
  headless:        true,
  schedulerEnabled: false,
};

function load() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = fs.readJsonSync(SETTINGS_FILE);
      // .env values override blank JSON values
      const merged = { ...DEFAULTS };
      for (const k of Object.keys(DEFAULTS)) {
        if (saved[k] !== undefined && saved[k] !== '') merged[k] = saved[k];
      }
      return merged;
    }
  } catch (_) {}
  return { ...DEFAULTS };
}

function save(updates) {
  fs.ensureDirSync(path.dirname(SETTINGS_FILE));
  const current = load();
  const next    = { ...current, ...updates };

  // Persist to JSON (includes sensitive — file is local only)
  fs.writeJsonSync(SETTINGS_FILE, next, { spaces: 2 });

  // Also update .env file so it survives restarts
  _patchEnvFile(updates);

  // Patch running process.env immediately
  for (const [k, envKey] of Object.entries(ENV_MAP)) {
    if (updates[k] !== undefined) process.env[envKey] = String(updates[k]);
  }

  return next;
}

function _patchEnvFile(updates) {
  try {
    let content = '';
    if (fs.existsSync(ENV_FILE)) content = fs.readFileSync(ENV_FILE, 'utf8');

    for (const [k, envKey] of Object.entries(ENV_MAP)) {
      if (updates[k] === undefined) continue;
      const val   = String(updates[k]);
      const regex = new RegExp(`^${envKey}=.*$`, 'm');
      if (regex.test(content)) {
        content = content.replace(regex, `${envKey}=${val}`);
      } else {
        content = content.trimEnd() + `\n${envKey}=${val}\n`;
      }
    }
    fs.writeFileSync(ENV_FILE, content);
  } catch (_) { /* non-fatal */ }
}

module.exports = { load, save };
