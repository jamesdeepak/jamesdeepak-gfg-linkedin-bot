const winston = require('winston');
const path = require('path');
const fs = require('fs-extra');

const LOG_DIR = path.resolve('./logs');
fs.ensureDirSync(LOG_DIR);

const fmt = winston.format;

const logger = winston.createLogger({
  level: 'info',
  format: fmt.combine(
    fmt.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    fmt.printf(({ timestamp, level, message }) =>
      `[${timestamp}] [${level.toUpperCase()}] ${message}`)
  ),
  transports: [
    new winston.transports.Console({
      format: fmt.combine(
        fmt.colorize(),
        fmt.timestamp({ format: 'HH:mm:ss' }),
        fmt.printf(({ timestamp, level, message }) =>
          `${timestamp} ${level}: ${message}`)
      )
    }),
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
      tailable: true
    })
  ]
});

module.exports = logger;
