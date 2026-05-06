'use strict';

const {
  reasonLabel,
  typeLabel,
  buildSubject,
  buildText,
  buildHtml,
  buildEmail,
} = require('../../lib/returns/build-email');

const { resolveReturnsEmail } = require('../../lib/returns');

describe('reasonLabel', () => {
  it('maps known reasons to French labels', () => {
    expect(reasonLabel('qualite')).toBe('Qualité non conforme');
    expect(reasonLabel('quantite')).toBe('Erreur de quantité');
    expect(reasonLabel('dlc')).toBe('DLC trop courte');
    expect(reasonLabel('abime')).toBe('Produit abîmé');
    expect(reasonLabel('manquant')).toBe('Produit manquant');
    expect(reasonLabel('autre')).toBe('Autre');
  });

  it('falls back to "Autre" for unknown values', () => {
    expect(reasonLabel('weird')).toBe('weird');
    expect(reasonLabel(null)).toBe('Autre');
    expect(reasonLabel(undefined)).toBe('Autre');
  });
});

describe('typeLabel', () => {
  it('returns French labels for return / credit', () => {
    expect(typeLabel('return')).toBe('Retour produit');
    expect(typeLabel('credit')).toBe("Demande d'avoir");
  });

  it('defaults to "Retour produit"', () => {
    expect(typeLabel('unknown')).toBe('Retour produit');
    expect(typeLabel(undefined)).toBe('Retour produit');
  });
});

describe('buildSubject', () => {
  it('uses the explicit reference when provided', () => {
    const subject = buildSubject({
      request: { id: 7, type: 'return', reference: 'RET-2026-007' },
      restaurant: { name: 'Le Comptoir du Marché' },
    });
    expect(subject).toBe('[Retour produit] RET-2026-007 — Le Comptoir du Marché');
  });

  it('falls back to RET-<id> when reference missing', () => {
    const subject = buildSubject({
      request: { id: 12, type: 'credit' },
      restaurant: { name: 'Bistrot Z' },
    });
    expect(subject).toBe("[Demande d'avoir] RET-12 — Bistrot Z");
  });
});

describe('buildText', () => {
  const base = {
    request: { id: 1, type: 'return', reference: 'RET-1', notes: 'Camion en retard de 4h.' },
    items: [
      { product_name: 'Tomates Coeur de Boeuf', quantity: 5, unit: 'kg', reason: 'abime', comment: 'Mou + traces de moisissure' },
      { product_name: 'Filet de bar', quantity: 2.5, unit: 'kg', reason: 'dlc' },
    ],
    restaurant: { name: 'Le Comptoir du Marché' },
    supplier: { name: 'Metro' },
    deliveryNote: { id: 42, delivery_date: '2026-05-06' },
  };

  it('lists every item with reason + comment', () => {
    const text = buildText(base);
    expect(text).toContain('Tomates Coeur de Boeuf');
    expect(text).toContain('5 kg');
    expect(text).toContain('Produit abîmé');
    expect(text).toContain('Mou + traces de moisissure');
    expect(text).toContain('Filet de bar');
    expect(text).toContain('2.5 kg');
    expect(text).toContain('DLC trop courte');
  });

  it('includes the restaurant name + reference + delivery note', () => {
    const text = buildText(base);
    expect(text).toContain('Le Comptoir du Marché');
    expect(text).toContain('RET-1');
    expect(text).toContain('Bon de livraison');
    expect(text).toContain('06/05/2026');
  });

  it('appends the request notes when present', () => {
    const text = buildText(base);
    expect(text).toContain('Camion en retard de 4h.');
  });

  it('skips delivery-note line when not linked', () => {
    const text = buildText({ ...base, deliveryNote: null });
    expect(text).not.toContain('Bon de livraison:');
  });
});

describe('buildHtml', () => {
  it('escapes HTML in product names + comments', () => {
    const html = buildHtml({
      request: { id: 1, type: 'return' },
      items: [{ product_name: '<script>x</script>', quantity: 1, reason: 'autre', comment: '"oops"' }],
      restaurant: { name: '<b>Resto</b>' },
    });
    expect(html).not.toContain('<script>x</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&lt;b&gt;Resto&lt;/b&gt;');
    expect(html).toContain('&quot;oops&quot;');
  });
});

describe('buildEmail', () => {
  it('returns subject + text + html in a single object', () => {
    const out = buildEmail({
      request: { id: 9, type: 'credit', reference: 'AV-9' },
      items: [{ product_name: 'Pomme', quantity: 3, unit: 'kg', reason: 'manquant' }],
      restaurant: { name: 'X' },
    });
    expect(out.subject).toMatch(/AV-9/);
    expect(out.text).toMatch(/Pomme/);
    expect(out.html).toMatch(/<table/);
  });
});

describe('resolveReturnsEmail', () => {
  it('prefers integration.returns_email over supplier email', () => {
    const out = resolveReturnsEmail({
      supplier: { email: 'commandes@example.com', returns_email: 'sav@example.com' },
      integration: { returns_email: 'retours@foodflow.fr' },
    });
    expect(out).toEqual({ email: 'retours@foodflow.fr', source: 'integration' });
  });

  it('falls back to supplier.returns_email when no integration', () => {
    const out = resolveReturnsEmail({
      supplier: { email: 'commandes@example.com', returns_email: 'sav@example.com' },
      integration: null,
    });
    expect(out).toEqual({ email: 'sav@example.com', source: 'supplier_returns_email' });
  });

  it('falls back to supplier.email when no returns mailbox set', () => {
    const out = resolveReturnsEmail({
      supplier: { email: 'commandes@example.com' },
      integration: { returns_email: null },
    });
    expect(out).toEqual({ email: 'commandes@example.com', source: 'supplier_email' });
  });

  it('returns null when supplier has no email at all', () => {
    expect(resolveReturnsEmail({ supplier: {}, integration: null })).toBeNull();
    expect(resolveReturnsEmail({ supplier: { email: '   ' }, integration: null })).toBeNull();
    expect(resolveReturnsEmail({ supplier: null, integration: null })).toBeNull();
  });

  it('skips empty integration value and falls through', () => {
    const out = resolveReturnsEmail({
      supplier: { email: 'main@example.com' },
      integration: { returns_email: '' },
    });
    expect(out).toEqual({ email: 'main@example.com', source: 'supplier_email' });
  });
});
