'use strict';

// Thin imapflow wrapper. Connects, fetches every UNSEEN message, parses each
// MIME body via mailparser into a normalized {from, attachments[]} shape, then
// optionally marks the messages \Seen so we don't reprocess them next cycle.
//
// Two non-obvious correctness rules baked into this file:
//
// 1. ImapFlow extends EventEmitter and emits async 'error' events on socket
//    timeout / TLS handshake failures. Without an 'error' listener, Node
//    crashes the whole process with "Unhandled error". Render's outbound TLS
//    to ssl0.ovh.net is sometimes slow enough to trip the default timeouts,
//    so we attach the listener BEFORE connect() and surface a rejected
//    promise from the connect-or-fail wrapper instead.
//
// 2. ImapFlow does NOT allow concurrent commands during a fetch iteration —
//    calling messageFlagsAdd inside the for-await loop corrupts the pipeline
//    and the next command throws "Connection not available" (code:NoConnection
//    from imap-flow.js:3506/3632 on a destroyed/!usable socket). The message
//    then stays UNSEEN and every subsequent 5-min poll repeats the same
//    crash forever. We drain the fetch generator into an array first, then
//    parse + mark-seen in a separate pass.
//
// Step-by-step console logs exist on purpose — when this fails on Render the
// only signal we have is the log line, so each operation announces itself
// before running and reports its result after.

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
  const t0 = Date.now();
  const elapsed = () => `${Date.now() - t0}ms`;

  let asyncError = null;
  client.on('error', (err) => {
    asyncError = err;
    console.warn(`📧 IMAP async error event: code=${err && err.code} message=${err && err.message}`);
  });
  client.on('close', () => {
    console.warn(`📧 IMAP socket close event (${elapsed()})`);
  });

  console.log('📧 IMAP: connecting…');
  try {
    await client.connect();
  } catch (e) {
    console.warn(`📧 IMAP connect failed (${elapsed()}): code=${e && e.code} message=${e && e.message}`);
    try { await client.logout(); } catch {}
    throw e;
  }
  console.log(
    `📧 IMAP: connected (${elapsed()}) authenticated=${client.authenticated} usable=${client.usable}`
  );

  const out = [];
  try {
    console.log('📧 IMAP: acquiring INBOX lock…');
    const lock = await client.getMailboxLock('INBOX');
    console.log(
      `📧 IMAP: INBOX lock acquired (exists=${client.mailbox && client.mailbox.exists} unseen=${client.mailbox && client.mailbox.unseen})`
    );
    try {
      // Phase 1 — drain fetch generator BEFORE issuing any other command.
      console.log('📧 IMAP: fetching UNSEEN…');
      const collected = [];
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        collected.push({ uid: msg.uid, source: msg.source });
      }
      console.log(`📧 IMAP: fetched ${collected.length} unseen message(s)`);

      // Phase 2 — fetch generator is closed; safe to issue messageFlagsAdd.
      for (const msg of collected) {
        let parsed;
        try {
          parsed = await simpleParser(msg.source);
        } catch (e) {
          console.warn(`📧 IMAP: simpleParser failed uid=${msg.uid} — ${e.message}`);
          if (markSeen) {
            try { await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true }); }
            catch (e2) { console.warn(`📧 IMAP: markSeen (post-parse-error) failed uid=${msg.uid} — ${e2.message}`); }
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
          // text + html flow through to match-restaurant so content matching
          // (restaurant name in body, account email in body, "référence
          // client : 89764" external_id) can fire on real-world FoodFlow
          // emails where the sender is a shared address.
          text: parsed.text || '',
          html: parsed.html || '',
          attachments: (parsed.attachments || []).map(a => ({
            filename: a.filename || '',
            content: a.content,
            contentType: a.contentType || '',
          })),
        });
        if (markSeen) {
          try {
            await client.messageFlagsAdd({ uid: msg.uid }, ['\\Seen'], { uid: true });
          } catch (e) {
            console.warn(`📧 IMAP: markSeen failed uid=${msg.uid} — ${e.message}`);
          }
        }
      }
    } finally {
      try { lock.release(); } catch (e) { console.warn(`📧 IMAP: lock.release threw — ${e.message}`); }
    }
  } finally {
    try { await client.logout(); } catch {}
    console.log(`📧 IMAP: cycle done (${elapsed()}) returned=${out.length}`);
  }

  if (asyncError && out.length === 0) throw asyncError;
  return out;
}

module.exports = { fetchUnseen };
