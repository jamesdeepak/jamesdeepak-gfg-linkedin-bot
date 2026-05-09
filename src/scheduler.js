const cron   = require('node-cron');
const logger = require('./logger');
const store  = require('./store');
const { run } = require('./runner');

let _job     = null;
let _running = false;
let _lastAt  = null;
let _emit    = () => {};

function setEmitter(fn) { _emit = fn; }

function start() {
  const cfg      = store.load();
  const schedule = cfg.cronSchedule || '0 6 * * *';
  const tz       = cfg.timezone     || 'Asia/Kolkata';

  if (_job) { _job.stop(); _job = null; }

  _job = cron.schedule(schedule, async () => {
    if (_running) { logger.warn('Scheduler: already running, skipping this tick.'); return; }
    logger.info('⏰ Scheduler triggered!');
    _running = true;
    _lastAt  = new Date().toISOString();
    try { await run(_emit); }
    catch (e) { logger.error('Scheduler run error: ' + e.message); }
    finally { _running = false; }
  }, { timezone: tz, scheduled: true });

  store.save({ schedulerEnabled: true });
  logger.info(`Scheduler started: "${schedule}" timezone: ${tz}`);
  return { schedule, tz };
}

function stop() {
  if (_job) { _job.stop(); _job = null; }
  store.save({ schedulerEnabled: false });
  logger.info('Scheduler stopped.');
}

function status() {
  const cfg = store.load();
  return {
    active:   !!_job,
    running:  _running,
    lastAt:   _lastAt,
    schedule: cfg.cronSchedule || '0 6 * * *',
    timezone: cfg.timezone     || 'Asia/Kolkata'
  };
}

const isRunning = () => _running;

module.exports = { start, stop, status, isRunning, setEmitter };
