'use strict';

// Thin nodemailer wrapper for OVH SMTP (ssl0.ovh.net:465 implicit TLS).
// Single shared transport — nodemailer pools connections internally, so we
// only construct it once. The orchestrator injects a fake sendFn in tests, so
// this module is intentionally not unit-tested.

const nodemailer = require('nodemailer');

let _transport = null;

function getTransport() {
  if (_transport) return _transport;
  _transport = nodemailer.createTransport({
    host: process.env.MERCURIALE_SMTP_HOST || 'ssl0.ovh.net',
    port: Number(process.env.MERCURIALE_SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.MERCURIALE_EMAIL,
      pass: process.env.MERCURIALE_PASSWORD,
    },
  });
  return _transport;
}

async function sendOrderEmail({ to, subject, text, xlsxBuffer, filename }) {
  const transport = getTransport();
  return transport.sendMail({
    from: process.env.MERCURIALE_EMAIL,
    to,
    subject,
    text,
    attachments: [{ filename, content: xlsxBuffer }],
  });
}

module.exports = { sendOrderEmail, getTransport };
