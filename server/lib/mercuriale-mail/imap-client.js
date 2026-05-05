'use strict';

// Thin imapflow wrapper. Connects, fetches every UNSEEN message, parses each
// MIME body via mailparser into a normalized {from, attachments[]} shape, then
// optionally marks the messages \Seen so we don't reprocess them next cycle.
// Failures bubble up to the orchestrator, which logs and continues.

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
  });
}

async function fetchUnseen({ markSeen = true } = {}) {
  const client = buildClient();
  await client.connect();
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
  return out;
}

module.exports = { fetchUnseen };
