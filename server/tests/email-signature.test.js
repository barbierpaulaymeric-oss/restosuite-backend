'use strict';

const {
  LOGO_CID,
  logoAttachment,
  signatureHtml,
  signatureText,
  applySignature,
  escapeHtml,
} = require('../lib/email-signature');

describe('email-signature', () => {
  describe('signatureHtml', () => {
    it('contains the tagline, site link and contact link in brand colours', () => {
      const html = signatureHtml();
      expect(html).toContain('restaurateurs attendaient'); // apostrophe is HTML-escaped
      expect(html).toContain('https://www.restosuite.fr');
      expect(html).toContain('mailto:contact@restosuite.fr');
      expect(html).toContain('#C45A18'); // brand orange links
      expect(html).toContain('#6b7280'); // grey text
    });

    it('references the logo via a CID image', () => {
      const html = signatureHtml();
      expect(html).toContain(`cid:${LOGO_CID}`);
    });
  });

  describe('signatureText', () => {
    it('includes the tagline, site and contact email', () => {
      const text = signatureText();
      expect(text).toContain("L'outil que les restaurateurs attendaient");
      expect(text).toContain('www.restosuite.fr');
      expect(text).toContain('contact@restosuite.fr');
    });
  });

  describe('logoAttachment', () => {
    it('returns a nodemailer CID attachment backed by the PNG', () => {
      const att = logoAttachment();
      expect(att).toBeTruthy();
      expect(att.cid).toBe(LOGO_CID);
      expect(att.contentType).toBe('image/png');
      expect(Buffer.isBuffer(att.content)).toBe(true);
      expect(att.content.length).toBeGreaterThan(0);
    });
  });

  describe('applySignature', () => {
    it('appends the text signature to a text-only message and synthesises HTML', () => {
      const out = applySignature({ text: 'Bonjour,\n\nVoici la commande.' });
      expect(out.text).toContain('Voici la commande.');
      expect(out.text).toContain('www.restosuite.fr');
      // Synthesised HTML part so the logo can render
      expect(out.html).toContain(`cid:${LOGO_CID}`);
      expect(out.html).toContain("restaurateurs attendaient");
      // Logo attachment added because an HTML part exists
      expect(out.attachments.some(a => a.cid === LOGO_CID)).toBe(true);
    });

    it('injects the signature before </body> of a provided HTML document', () => {
      const html = '<!DOCTYPE html><html><body><p>Hi</p></body></html>';
      const out = applySignature({ text: 'Hi', html });
      const sigIdx = out.html.indexOf('restaurateurs attendaient');
      const bodyClose = out.html.indexOf('</body>');
      expect(sigIdx).toBeGreaterThan(-1);
      expect(sigIdx).toBeLessThan(bodyClose); // signature lands inside <body>
    });

    it('preserves caller-supplied attachments and adds the logo', () => {
      const extra = { filename: 'commande.xlsx', content: Buffer.from('x') };
      const out = applySignature({ text: 'Hi', attachments: [extra] });
      expect(out.attachments).toContainEqual(extra);
      expect(out.attachments.some(a => a.cid === LOGO_CID)).toBe(true);
    });

    it('leaves an empty message without an HTML part or logo', () => {
      const out = applySignature({});
      expect(out.html).toBeUndefined();
      expect(out.attachments).toEqual([]);
    });
  });

  describe('escapeHtml', () => {
    it('escapes angle brackets and quotes', () => {
      expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    });
  });
});
