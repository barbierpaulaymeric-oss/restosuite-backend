'use strict';

// Thin nodemailer wrapper for OVH SMTP (ssl0.ovh.net:465 implicit TLS).
// Single shared transport — nodemailer pools connections internally, so we
// only construct it once. The orchestrator injects a fake sendFn in tests, so
// this module is intentionally not unit-tested.

const nodemailer = require('nodemailer');
const { applySignature } = require('../email-signature');

// Adresse de contact (relances rétention, email de bienvenue). Surchargeable via
// CONTACT_EMAIL ; par défaut l'adresse publique de la signature.
const CONTACT_EMAIL = process.env.CONTACT_EMAIL || 'contact@restosuite.fr';

let _transport = null;
let _contactTransport = null;

// Timeouts explicites (parité avec imap-client) pour qu'un socket OVH lent/bloqué
// remonte une promesse rejetée au lieu de bloquer l'envoi fire-and-forget.
function smtpTimeouts() {
  return {
    connectionTimeout: Number(process.env.MERCURIALE_SMTP_CONNECT_TIMEOUT_MS) || 20000,
    greetingTimeout: Number(process.env.MERCURIALE_SMTP_GREETING_TIMEOUT_MS) || 16000,
    socketTimeout: Number(process.env.MERCURIALE_SMTP_SOCKET_TIMEOUT_MS) || 30000,
  };
}

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
    ...smtpTimeouts(),
  });
  return _transport;
}

// Transport pour les emails « contact@ ». Si un compte dédié est configuré
// (CONTACT_SMTP_USER / CONTACT_SMTP_PASS), on s'authentifie avec lui. Sinon on
// réutilise le transport mercuriale : OVH (ssl0.ovh.net) autorise l'envoi depuis
// une adresse du compte authentifié dès lors qu'elle est un alias du compte — le
// `from` reste contact@ dans tous les cas (cf. sendContactEmail).
function getContactTransport() {
  const user = process.env.CONTACT_SMTP_USER;
  const pass = process.env.CONTACT_SMTP_PASS;
  if (!user || !pass) return getTransport();
  if (_contactTransport) return _contactTransport;
  const port = Number(process.env.CONTACT_SMTP_PORT) || Number(process.env.MERCURIALE_SMTP_PORT) || 465;
  _contactTransport = nodemailer.createTransport({
    host: process.env.CONTACT_SMTP_HOST || process.env.MERCURIALE_SMTP_HOST || 'ssl0.ovh.net',
    port,
    secure: port === 465,
    auth: { user, pass },
    ...smtpTimeouts(),
  });
  return _contactTransport;
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

// Email applicatif (relances rétention, bienvenue) envoyé depuis contact@ — JAMAIS
// depuis mercuriale@, dont la boîte est pollée pour les mercuriales fournisseurs.
// from + replyTo pointent sur contact@ : un destinataire qui « répond à ce mail »
// tombe donc bien dans la boîte contact et non dans le flux mercuriale.
async function sendContactEmail({ to, cc, bcc, subject, text, html, attachments }) {
  const transport = getContactTransport();
  const sig = applySignature({ text, html, attachments });
  const msg = {
    from: CONTACT_EMAIL,
    replyTo: CONTACT_EMAIL,
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

module.exports = { sendOrderEmail, sendPlainEmail, sendContactEmail, getTransport, getContactTransport };
