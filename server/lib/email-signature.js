'use strict';

// Shared, branded email signature for every system-sent email (bons de
// commande, retours, alertes, invitations fournisseur…). Centralised here so
// the smtp-client applies it once for all callers — add a new send path and it
// inherits the signature for free.
//
// The logo is embedded as a CID attachment (cid:restosuite-logo) rather than a
// data-URI: Gmail/Outlook strip inline base64 <img> for privacy, but display
// CID-referenced attachments reliably. The PNG is read once and cached.

const fs = require('fs');
const path = require('path');

const ORANGE = '#C45A18'; // brand accent — links
const GREY = '#6b7280';   // brand muted text

const LOGO_CID = 'restosuite-logo';
const LOGO_PATH = path.join(__dirname, '..', '..', 'client', 'assets', 'logo-512.png');

const TAGLINE = "RestoSuite — L'outil que les restaurateurs attendaient.";
const SITE_URL = 'https://www.restosuite.fr';
const SITE_LABEL = 'www.restosuite.fr';
const CONTACT_EMAIL = 'contact@restosuite.fr';

let _logoBuffer; // undefined = not loaded yet, null = file missing
function logoBuffer() {
  if (_logoBuffer === undefined) {
    try {
      _logoBuffer = fs.readFileSync(LOGO_PATH);
    } catch (_) {
      _logoBuffer = null; // logo optional — signature degrades to text only
    }
  }
  return _logoBuffer;
}

// nodemailer attachment that backs the cid:restosuite-logo reference. Returns
// null when the PNG can't be read so the caller simply skips the image.
function logoAttachment() {
  const buf = logoBuffer();
  if (!buf) return null;
  return {
    filename: 'restosuite-logo.png',
    content: buf,
    cid: LOGO_CID,
    contentType: 'image/png',
  };
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// HTML signature block. Logo ~96px wide, tagline in grey, links in brand orange.
function signatureHtml() {
  const logo = logoBuffer()
    ? `<img src="cid:${LOGO_CID}" width="96" alt="RestoSuite"`
      + ` style="display:block;border:0;outline:none;width:96px;height:auto;margin:0 0 10px">`
    : '';
  return `
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #e5e7eb;`
    + `font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    ${logo}
    <p style="margin:0 0 4px;color:${GREY};font-size:13px;font-weight:600">${escapeHtml(TAGLINE)}</p>
    <p style="margin:0;color:${GREY};font-size:13px">
      <a href="${SITE_URL}" style="color:${ORANGE};text-decoration:none">${SITE_LABEL}</a>
      &nbsp;&middot;&nbsp;
      <a href="mailto:${CONTACT_EMAIL}" style="color:${ORANGE};text-decoration:none">${CONTACT_EMAIL}</a>
    </p>
  </div>`;
}

// Plain-text signature for the text/plain MIME part (and text-only clients).
function signatureText() {
  return [
    '',
    `— ${TAGLINE}`,
    `${SITE_LABEL} · ${CONTACT_EMAIL}`,
  ].join('\n');
}

function textToHtml(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function wrapHtmlDocument(innerHtml) {
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111827;`
    + `max-width:640px;margin:0 auto;padding:24px;font-size:14px;line-height:1.5">
${innerHtml}
</body></html>`;
}

function injectHtmlSignature(html) {
  const sig = signatureHtml();
  // Insert just before </body> when the caller gave a full document; otherwise
  // append (fragment emails render fine without an explicit body wrapper).
  if (/<\/body>/i.test(html)) {
    return html.replace(/<\/body>/i, `${sig}\n</body>`);
  }
  return `${html}${sig}`;
}

// Append the branded signature to an outgoing message. Returns the augmented
// { text, html, attachments } ready to spread into nodemailer's sendMail.
//   • text  → plain-text signature appended.
//   • html  → branded signature injected before </body> (or appended).
//   • no html but text present → an HTML part is synthesised from the text so
//     the logo always renders; the original text part is preserved.
//   • logo attachment added whenever an HTML part exists.
function applySignature({ text, html, attachments } = {}) {
  const out = { attachments: Array.isArray(attachments) ? attachments.slice() : [] };

  if (text != null && text !== '') {
    out.text = `${text}\n${signatureText()}`;
  } else if (text != null) {
    out.text = text;
  }

  let finalHtml = null;
  if (html != null && html !== '') {
    finalHtml = injectHtmlSignature(html);
  } else if (text != null && text !== '') {
    finalHtml = wrapHtmlDocument(`${textToHtml(text)}${signatureHtml()}`);
  }

  if (finalHtml) {
    out.html = finalHtml;
    const logo = logoAttachment();
    if (logo) out.attachments.push(logo);
  }

  return out;
}

module.exports = {
  LOGO_CID,
  logoAttachment,
  signatureHtml,
  signatureText,
  applySignature,
  escapeHtml,
};
