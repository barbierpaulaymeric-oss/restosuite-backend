'use strict';

// Thin imapflow wrapper. Connects, fetches every UNSEEN message, parses each
// MIME body via mailparser into a normalized {from, attachments[]} shape, then
// optionally marks the messages \Seen so we don't reprocess them next cycle.
//
// Error handling is deliberately defensive: ImapFlow extends EventEmitter and
// emits 'error' events on socket timeout / TLS handshake failures. Without an
// 'error' listener, Node crashes the whole process with "Unhandled error".
// Render's outbound TLS to ssl0.ovh.net is sometimes slow enough to trip the
// default timeouts, so we attach the listener BEFORE connect() and surface a
// rejected promise from a single connect-or-fail wrapper instead.

const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');

function buildClient() {
  return new ImapFlow({
    host: process.env.MERCURIALE_IMAP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.MERCURIALE_IMAP_PORT) || 993,
    secure: true,
    auth: {
      user: process.env.MERCURIALE_EMAIL,
      pass: process.env.MERCURIALE_PASSWORD,
    },
    logger: false,
    connectionTimeout: Number(process.env.MERCURIALE_IMAP_CONNECT_TIMEOUT_MS) || 30000,
    greetingTimeout: Number(process.env.MERCURIALE_IMAP_GREETING_TIMEOUT_MS) || 16000,
    socketTimeout: Number(process.env.MERCURIALE_IMAP_SOCKET_TIMEOUT_MS) || 60000,
    tls: { minVersion: 'TLSv1.2' },
  });
}

async function fetchUnseen({ markSeen = true } = {}) {
  const client = buildClient();

  // Catch async ImapFlow 'error' events so a stray socket timeout after we've
  // returned doesn't crash the process. We re-throw the most recent one only
  // if our own try-block hasn't already failed.
  let asyncError = null;
  client.on('error', (err) => {
    asyncError = err;
    console.warn('📧 IMAP async error:', err && err.message);
  });

  try {
    await client.connect();
  } catch (e) {
    console.warn('📧 IMAP connect failed:', e && e.message);
    try { await client.logout(); } catch {}
    throw e;
  }

  const out = [];
  try {
    const lock = await client.getMailboxLock('INBOX');
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        let parsed;
        try { parsed = await simpleParser(msg.source); }
        catch (e) {
          // Skip messages we can't parse but mark them seen so we don't loop forever.
          if (markSeen) {
            try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }); } catch {}
          }
          continue;
        }
        const fromAddr = parsed.from
          && parsed.from.value
          && parsed.from.value[0]
          && parsed.from.value[0].address || '';
        out.push({
          uid: msg.uid,
          from: fromAddr,
          subject: parsed.subject || '',
          date: parsed.date || new Date(),
          attachments: (parsed.attachments || []).map(a => ({
            filename: a.filename || '',
            content: a.content,
            contentType: a.contentType || '',
          })),
        });
        if (markSeen) {
          try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }); } catch {}
        }
      }
    } finally {
      lock.release();
    }
  } finally {
    try { await client.logout(); } catch {}
  }

  if (asyncError && out.length === 0) throw asyncError;
  return out;
}

module.exports = { fetchUnseen };
