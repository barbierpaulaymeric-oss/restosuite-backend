'use strict';

// Thin nodemailer wrapper for OVH SMTP (ssl0.ovh.net:465 implicit TLS).
// Single shared transport — nodemailer pools connections internally, so we
// only construct it once. The orchestrator injects a fake sendFn in tests, so
// this module is intentionally not unit-tested.

const nodemailer = require('nodemailer');
const { applySignature } = require('../email-signature');

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  // 465 = implicit TLS (secure), 587 = STARTTLS (secure must be false). Derive
  // `secure` from the port so an env override to 587 doesn't deadlock the TLS
  // handshake — that was the failure mode behind the IMAP timeouts.
  const port = Number(process.env.MERCURIALE_SMTP_PORT) || 465;
  _transport = nodemailer.createTransport({
    host: process.env.MERCURIALE_SMTP_HOST || 'ssl0.ovh.net',
    port,
    secure: port === 465,
    auth: {
      user: process.env.MERCURIALE_EMAIL,
      pass: process.env.MERCURIALE_PASSWORD,
    },
    // Explicit timeouts (parity with imap-client) so a slow/blocked OVH socket
    // surfaces as a rejected promise instead of hanging the fire-and-forget send.
    connectionTimeout: Number(process.env.MERCURIALE_SMTP_CONNECT_TIMEOUT_MS) || 20000,
    greetingTimeout: Number(process.env.MERCURIALE_SMTP_GREETING_TIMEOUT_MS) || 16000,
    socketTimeout: Number(process.env.MERCURIALE_SMTP_SOCKET_TIMEOUT_MS) || 30000,
  });
  return _transport;
}

async function sendOrderEmail({ to, bcc, subject, text, html, xlsxBuffer, filename, attachments }) {
  const transport = getTransport();
  // applySignature appends the branded RestoSuite signature (logo + tagline +
  // links) and returns the logo CID attachment alongside any caller extras.
  const sig = applySignature({ text, html, attachments });
  const msg = {
    from: process.env.MERCURIALE_EMAIL,
    to,
    subject,
    text: sig.text,
    attachments: [{ filename, content: xlsxBuffer }, ...sig.attachments],
  };
  if (sig.html) msg.html = sig.html;
  if (bcc) msg.bcc = bcc;
  return transport.sendMail(msg);
}

async function sendPlainEmail({ to, cc, bcc, subject, text, html, attachments }) {
  const transport = getTransport();
  const sig = applySignature({ text, html, attachments });
  const msg = {
    from: process.env.MERCURIALE_EMAIL,
    to,
    subject,
    text: sig.text,
  };
  if (sig.html) msg.html = sig.html;
  if (sig.attachments.length) msg.attachments = sig.attachments;
  if (cc) msg.cc = cc;
  if (bcc) msg.bcc = bcc;
  return transport.sendMail(msg);
}

module.exports = { sendOrderEmail, sendPlainEmail, getTransport };
