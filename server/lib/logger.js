// ═══════════════════════════════════════════
// Structured JSON logger
// Outputs one JSON object per line to stdout/stderr.
// Format: { ts, level, msg, request_id?, ...fields }
// In test mode, logger is silent unless LOG_IN_TEST=1.
// ═══════════════════════════════════════════

const IS_TEST = process.env.NODE_ENV === 'test' && process.env.LOG_IN_TEST !== '1';

function write(level, msg, fields) {
  if (IS_TEST) return;
  const entry = { ts: new Date().toISOString(), level, msg: String(msg), ...(fields || {}) };
  const line = JSON.stringify(entry);
  if (level === 'error' || level === 'fatal') process.stderr.write(line + '\n');
  else process.stdout.write(line + '\n');
}

const logger = {
  info: (msg, fields) => write('info', msg, fields),
  warn: (msg, fields) => write('warn', msg, fields),
  error: (msg, fields) => write('error', msg, fields),
  debug: (msg, fields) => write('debug', msg, fields),
  fatal: (msg, fields) => write('fatal', msg, fields),

  // Returns a child logger that auto-attaches request_id to every entry.
  forRequest(req) {
    const rid = (req && req.id) ? req.id : undefined;
    const base = rid ? { request_id: rid } : {};
    return {
      info:  (msg, fields) => write('info',  msg, { ...base, ...(fields || {}) }),
      warn:  (msg, fields) => write('warn',  msg, { ...base, ...(fields || {}) }),
      error: (msg, fields) => write('error', msg, { ...base, ...(fields || {}) }),
      debug: (msg, fields) => write('debug', msg, { ...base, ...(fields || {}) }),
      fatal: (msg, fields) => write('fatal', msg, { ...base, ...(fields || {}) }),
    };
  },
};

module.exports = logger;
