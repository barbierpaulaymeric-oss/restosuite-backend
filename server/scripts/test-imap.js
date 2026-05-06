#!/usr/bin/env node
'use strict';

// IMAP connectivity diagnostic for the OVH mercuriale mailbox.
//
// Runs three isolated stages and logs every step. Designed to be run from the
// Render Shell (or locally with the same env vars) when the poller fails with
// "Connection not available" — most often a clue that the password got mangled
// by env var quoting, that port 993 egress is blocked, or that TLS to OVH is
// stalling before greeting.
//
//   1. DNS — resolve4 ssl0.ovh.net (or MERCURIALE_IMAP_HOST)
//   2. Raw TLS — net + tls.connect, log handshake events, dump the IMAP greeting
//   3. ImapFlow — connect, list mailboxes, count UNSEEN in INBOX
//
// Stage 2 isolates "is it a TLS/network issue or an imapflow library issue".
// If stage 2 succeeds and stage 3 fails, the problem is auth / imapflow.
// If stage 2 fails, it's the network/firewall/TLS stack.
//
// We never log the password. We do log:
//   - host, port, user (full)
//   - password length, first 3 chars + last 3 chars (masked middle)
//   - charCodes of each password char (lets us detect bash-mangled "!" /
//     stripped whitespace / smart quotes without exposing the secret)

const dns = require('dns').promises;
const tls = require('tls');

const HOST = process.env.MERCURIALE_IMAP_HOST || 'ssl0.ovh.net';
const PORT = Number(process.env.MERCURIALE_IMAP_PORT) || 993;
const USER = process.env.MERCURIALE_EMAIL || '';
const PASS = process.env.MERCURIALE_PASSWORD || '';

function maskPassword(p) {
  if (!p) return '(unset)';
  if (p.length <= 6) return `(len=${p.length}, too short to mask safely)`;
  const head = p.slice(0, 3);
  const tail = p.slice(-3);
  const mid = '*'.repeat(p.length - 6);
  return `${head}${mid}${tail} (len=${p.length})`;
}

function passwordCharCodes(p) {
  if (!p) return [];
  return Array.from(p).map((ch, i) => ({ i, code: ch.charCodeAt(0) }));
}

function nowMs() {
  return Date.now();
}

async function stage1Dns() {
  console.log('\n=== Stage 1: DNS ===');
  console.log(`Resolving ${HOST}...`);
  const t0 = nowMs();
  try {
    const a = await dns.resolve4(HOST);
    console.log(`✓ A records: ${JSON.stringify(a)} (${nowMs() - t0}ms)`);
  } catch (e) {
    console.error(`✗ DNS resolve4 failed: ${e.message}`);
    return false;
  }
  try {
    const aaaa = await dns.resolve6(HOST);
    console.log(`  AAAA records: ${JSON.stringify(aaaa)}`);
  } catch (e) {
    console.log(`  (no AAAA: ${e.code || e.message})`);
  }
  return true;
}

async function stage2RawTls() {
  console.log('\n=== Stage 2: Raw TLS ===');
  console.log(`tls.connect(${PORT}, '${HOST}', servername='${HOST}', minVersion='TLSv1.2')`);
  const t0 = nowMs();
  return new Promise((resolve) => {
    const sock = tls.connect(
      {
        host: HOST,
        port: PORT,
        servername: HOST,
        minVersion: 'TLSv1.2',
      },
      () => {
        const proto = sock.getProtocol();
        const cipher = sock.getCipher();
        const peer = sock.getPeerCertificate();
        console.log(`✓ TLS handshake OK (${nowMs() - t0}ms)`);
        console.log(`  protocol: ${proto}`);
        console.log(`  cipher: ${cipher && cipher.name} ${cipher && cipher.version}`);
        console.log(`  peerCert.subject: ${peer && peer.subject && peer.subject.CN}`);
        console.log(`  peerCert.issuer: ${peer && peer.issuer && peer.issuer.CN}`);
        console.log(`  peerCert.valid_to: ${peer && peer.valid_to}`);
        console.log(`  authorized: ${sock.authorized} (${sock.authorizationError || 'ok'})`);
      }
    );

    let greeting = '';
    let done = false;
    let timer = setTimeout(() => {
      if (done) return;
      done = true;
      console.error('✗ Timeout waiting for IMAP greeting (15s)');
      try { sock.destroy(); } catch {}
      resolve(false);
    }, 15000);

    sock.setEncoding('utf8');
    sock.on('data', (chunk) => {
      if (done) return;
      greeting += chunk;
      if (greeting.includes('\r\n')) {
        done = true;
        clearTimeout(timer);
        const firstLine = greeting.split('\r\n')[0];
        console.log(`✓ IMAP greeting: ${firstLine}`);
        try { sock.write('A001 LOGOUT\r\n'); } catch {}
        setTimeout(() => { try { sock.destroy(); } catch {}; resolve(true); }, 200);
      }
    });

    sock.on('error', (err) => {
      clearTimeout(timer);
      console.error(`✗ TLS socket error: code=${err.code} message=${err.message}`);
      resolve(false);
    });
    sock.on('end', () => {
      // Server closed cleanly — fine if greeting already arrived.
    });
  });
}

async function stage3ImapFlow() {
  console.log('\n=== Stage 3: ImapFlow ===');
  if (!USER || !PASS) {
    console.warn('⚠ MERCURIALE_EMAIL or MERCURIALE_PASSWORD not set — skipping');
    return 'skip';
  }
  let ImapFlow;
  try {
    ({ ImapFlow } = require('imapflow'));
  } catch (e) {
    console.error(`✗ Failed to require imapflow: ${e.message}`);
    return false;
  }

  const client = new ImapFlow({
    host: HOST,
    port: PORT,
    secure: true,
    auth: { user: USER, pass: PASS },
    logger: false,
    connectionTimeout: 30000,
    greetingTimeout: 16000,
    socketTimeout: 60000,
    tls: { minVersion: 'TLSv1.2' },
  });

  let asyncErr = null;
  client.on('error', (err) => {
    asyncErr = err;
    console.warn(`  (async error event: code=${err.code} message=${err.message})`);
  });

  const t0 = nowMs();
  try {
    console.log('Calling client.connect()...');
    await client.connect();
    console.log(`✓ ImapFlow connected (${nowMs() - t0}ms)`);
  } catch (e) {
    console.error(`✗ ImapFlow.connect failed: code=${e.code || '?'} response=${e.responseText || e.response || '?'}`);
    console.error(`  message: ${e.message}`);
    if (e.authenticationFailed) {
      console.error('  authenticationFailed=true → wrong password OR password mangled by env var quoting');
    }
    if (asyncErr) {
      console.error(`  preceding async error: ${asyncErr.message}`);
    }
    try { await client.logout(); } catch {}
    return false;
  }

  try {
    console.log('Listing mailboxes...');
    const mboxes = await client.list();
    console.log(`✓ ${mboxes.length} mailboxes: ${mboxes.slice(0, 8).map(m => m.path).join(', ')}${mboxes.length > 8 ? '…' : ''}`);

    const lock = await client.getMailboxLock('INBOX');
    try {
      const status = await client.status('INBOX', { messages: true, unseen: true });
      console.log(`✓ INBOX status: ${JSON.stringify(status)}`);
    } finally {
      lock.release();
    }
    return true;
  } catch (e) {
    console.error(`✗ Post-auth op failed: ${e.message}`);
    return false;
  } finally {
    try { await client.logout(); } catch {}
  }
}

(async () => {
  console.log('═══ IMAP diagnostic for RestoSuite mercuriale poller ═══');
  console.log(`Host:     ${HOST}`);
  console.log(`Port:     ${PORT}`);
  console.log(`User:     ${USER || '(MERCURIALE_EMAIL unset)'}`);
  console.log(`Password: ${maskPassword(PASS)}`);
  if (PASS) {
    // Char-code dump catches "!" → bash history expansion, smart quotes, and
    // hidden whitespace without leaking the secret. Look for unexpected codes
    // (e.g. 33="!" missing → mangled; 8217="’" → smart quote substitution).
    const codes = passwordCharCodes(PASS);
    console.log(`Password char codes: ${JSON.stringify(codes)}`);
  }
  console.log(`Node:     ${process.version}`);

  const dnsOk = await stage1Dns();
  const tlsOk = dnsOk ? await stage2RawTls() : false;
  const imapResult = tlsOk ? await stage3ImapFlow() : false;

  const imapOk = imapResult === true;
  const imapSkipped = imapResult === 'skip';

  console.log('\n=== Summary ===');
  console.log(`DNS:       ${dnsOk ? 'OK' : 'FAIL'}`);
  console.log(`Raw TLS:   ${tlsOk ? 'OK' : 'FAIL'}`);
  console.log(`ImapFlow:  ${imapOk ? 'OK' : imapSkipped ? 'SKIPPED (creds unset)' : 'FAIL'}`);
  if (!dnsOk) console.log('→ DNS broken: check /etc/resolv.conf or Render outbound DNS.');
  else if (!tlsOk) console.log('→ TLS/network broken: Render egress to ssl0.ovh.net:993 may be blocked.');
  else if (imapSkipped) console.log('→ Set MERCURIALE_EMAIL and MERCURIALE_PASSWORD to test auth.');
  else if (!imapOk) console.log('→ Auth broken: password likely mangled by env var quoting (compare char codes above to the literal password).');
  else console.log('→ All stages passed. Mercuriale poller should work — re-check poller logs.');

  process.exit(imapOk || imapSkipped ? 0 : 1);
})().catch((e) => {
  console.error('Diagnostic crashed:', e);
  process.exit(2);
});
