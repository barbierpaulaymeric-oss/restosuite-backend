'use strict';

// Pure unit tests for the restaurant-identification logic that runs before
// supplier resolution. Inputs are POJOs + lookup callbacks so no IMAP/DB
// is needed.

const xlsx = require('xlsx');
const {
  extractIdentifiers,
  extractExcelBannerText,
  extractSupplierNamesFromXlsx,
  matchRestaurant,
} = require('../../lib/mercuriale-mail/match-restaurant');

function makeXlsx(rows) {
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, xlsx.utils.aoa_to_sheet(rows), 'S');
  return xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ─── extractIdentifiers ──────────────────────────────────────────────

describe('extractIdentifiers', () => {
  test('returns empty arrays on empty input', () => {
    const r = extractIdentifiers({});
    expect(r.externalIds).toEqual([]);
    expect(r.emails).toEqual([]);
    expect(r.names).toEqual([]);
  });

  test('extracts FF-XXX external_ids from subject + body, dedup, uppercased', () => {
    const r = extractIdentifiers({
      subject: 'Mercuriale FF-abc123 cette semaine',
      text: 'Pour le client (FF-ABC123) et aussi FF-XYZ-7',
    });
    expect(r.externalIds.sort()).toEqual(['FF-ABC123', 'FF-XYZ-7']);
  });

  test('extracts numeric external_ids labelled "référence client : 89764" / "ID 12345"', () => {
    const r = extractIdentifiers({
      text: 'Voici la mercuriale pour TestRestoSuite (référence client : 89764) email : test@x.com\nID: 41200',
    });
    expect(r.externalIds).toEqual(expect.arrayContaining(['89764', '41200']));
  });

  test('extracts emails from body, lowercased, deduped, ignores mercuriale@/no-reply@', () => {
    const r = extractIdentifiers({
      subject: 'mercuriale@restosuite.fr',
      text: 'Adresse: chef@bistrot.fr\nCC: chef@bistrot.fr\nReply-to: no-reply@foodflow.com',
    });
    expect(r.emails).toEqual(['chef@bistrot.fr']);
  });

  test('extracts candidate names from "Restaurant:" / "Client:" / "Pour:" / "Établissement:" labels', () => {
    const r = extractIdentifiers({
      text: 'Bonjour,\nRestaurant : Le Comptoir du Marché\nClient: TestRestoSuite\nPour : Bistrot Bobo\n',
    });
    expect(r.names).toEqual(expect.arrayContaining([
      'Le Comptoir du Marché',
      'TestRestoSuite',
      'Bistrot Bobo',
    ]));
  });

  test('extracts name from "pour X" with no separator (real FoodFlow body)', () => {
    const r = extractIdentifiers({
      text: 'Voici la mercuriale pour TestRestoSuite (référence client : 89764) email : barbierpaulaymeric@gmail.com',
    });
    expect(r.names).toContain('TestRestoSuite');
    expect(r.emails).toContain('barbierpaulaymeric@gmail.com');
    expect(r.externalIds).toContain('89764');
  });

  test('handles HTML body by stripping tags', () => {
    const r = extractIdentifiers({
      html: '<p>Restaurant: <b>TestRestoSuite</b></p><p>ID: FF-99</p>',
    });
    expect(r.names).toContain('TestRestoSuite');
    expect(r.externalIds).toContain('FF-99');
  });

  test('case-insensitive label, allows accents in restaurant name', () => {
    const r = extractIdentifiers({
      text: 'établissement: Café des Sports',
    });
    expect(r.names).toContain('Café des Sports');
  });

  test('drops generic stopwords like "Pour information"', () => {
    const r = extractIdentifiers({
      text: 'Pour information : tarifs en hausse cette semaine',
    });
    expect(r.names).not.toContain('information');
  });
});

// ─── extractExcelBannerText ──────────────────────────────────────────

describe('extractExcelBannerText', () => {
  test('reads first ~5 rows of cells before the data table', () => {
    const buf = makeXlsx([
      ['Tarifs FoodFlow — Restaurant: TestRestoSuite (FF-12345)'],
      [''],
      ['Désignation', 'Catégorie', 'Unité', 'Prix HT'],
      ['Tomate', 'Légumes', 'kg', '3,20'],
    ]);
    const text = extractExcelBannerText(buf);
    expect(text).toContain('TestRestoSuite');
    expect(text).toContain('FF-12345');
  });

  test('returns empty string on null/empty buffer', () => {
    expect(extractExcelBannerText(null)).toBe('');
    expect(extractExcelBannerText(Buffer.alloc(0))).toBe('');
  });

  test('does not throw on garbage buffer (parser error swallowed, string returned)', () => {
    expect(typeof extractExcelBannerText(Buffer.from('not-an-xlsx'))).toBe('string');
  });
});

// ─── extractSupplierNamesFromXlsx ────────────────────────────────────

describe('extractSupplierNamesFromXlsx', () => {
  test('extracts distinct values from "Fournisseur" column (case-insensitive)', () => {
    const buf = makeXlsx([
      ['Désignation', 'Fournisseur', 'Prix HT'],
      ['Tomate', 'Foodflow', '3,20'],
      ['Oignon', 'foodflow', '1,80'],
      ['Carotte', 'PassionFroid', '2,40'],
    ]);
    const names = extractSupplierNamesFromXlsx(buf);
    expect(names).toEqual(expect.arrayContaining(['Foodflow', 'PassionFroid']));
  });

  test('skips the header row above the supplier column', () => {
    const buf = makeXlsx([
      ['Tarifs Q2 — exclusif TestRestoSuite'],
      ['Désignation', 'Fournisseur', 'Prix'],
      ['Burrata', 'Metro France', '4,90'],
    ]);
    const names = extractSupplierNamesFromXlsx(buf);
    expect(names).toEqual(['Metro France']);
  });

  test('returns empty array when no supplier column exists', () => {
    const buf = makeXlsx([
      ['Désignation', 'Catégorie', 'Prix'],
      ['Tomate', 'Légumes', '3,20'],
    ]);
    expect(extractSupplierNamesFromXlsx(buf)).toEqual([]);
  });

  test('returns empty array on null/garbage buffer', () => {
    expect(extractSupplierNamesFromXlsx(null)).toEqual([]);
    expect(extractSupplierNamesFromXlsx(Buffer.from('not-an-xlsx'))).toEqual([]);
  });
});

// ─── matchRestaurant ─────────────────────────────────────────────────

describe('matchRestaurant', () => {
  const EMPTY_LOOKUPS = {
    byExternalId: () => null,
    byEmail: () => null,
    byName: () => null,
  };

  test('returns identifiers + null restaurantId when nothing matches', () => {
    const r = matchRestaurant({
      email: { subject: 'Hello', text: 'no identifiers here', from: 'x@y.com' },
      lookups: EMPTY_LOOKUPS,
    });
    expect(r.restaurantId).toBeNull();
    expect(r.identifiers).toEqual({
      externalIds: [], emails: [], names: [], supplierNames: [],
    });
  });

  test('matches by restaurant name FIRST (priority 1) — beats sender, beats external_id', () => {
    const r = matchRestaurant({
      email: {
        subject: 'Mercuriale TestRestoSuite',
        text: 'Voici la mercuriale pour TestRestoSuite (référence client : 89764) email : owner@x.com',
        from: 'shared@foodflow.com',
      },
      lookups: {
        byExternalId: (id) => id === '89764' ? { restaurantId: 99, supplierId: 33 } : null,
        byEmail: (e) => e === 'owner@x.com' ? { restaurantId: 88 } : null,
        byName: (n) => n === 'TestRestoSuite' ? { restaurantId: 7 } : null,
      },
    });
    expect(r.restaurantId).toBe(7);
    expect(r.matchedBy).toBe('name');
    expect(r.matchedValue).toBe('TestRestoSuite');
    expect(r.identifiers.names).toContain('TestRestoSuite');
    expect(r.identifiers.emails).toContain('owner@x.com');
    expect(r.identifiers.externalIds).toContain('89764');
  });

  test('matches by account email (priority 2) when name miss', () => {
    const r = matchRestaurant({
      email: {
        subject: 'Mercuriale',
        text: 'Bonjour, voici la mercuriale pour barbierpaulaymeric@gmail.com',
        from: 'julie@foodflow.com',
      },
      lookups: {
        byExternalId: () => null,
        byEmail: (e) => e === 'barbierpaulaymeric@gmail.com' ? { restaurantId: 7 } : null,
        byName: () => null,
      },
    });
    expect(r.restaurantId).toBe(7);
    expect(r.matchedBy).toBe('email');
    expect(r.matchedValue).toBe('barbierpaulaymeric@gmail.com');
  });

  test('matches by external_id (priority 3) when name + email miss', () => {
    const r = matchRestaurant({
      email: {
        subject: 'Mercuriale FF-12345',
        text: '',
        from: 'julie@foodflow.com',
      },
      lookups: {
        byExternalId: (id) => id === 'FF-12345' ? { restaurantId: 7, supplierId: 33 } : null,
        byEmail: () => null,
        byName: () => null,
      },
    });
    expect(r.restaurantId).toBe(7);
    expect(r.supplierId).toBe(33);
    expect(r.matchedBy).toBe('external_id');
  });

  test('uses Excel banner content when subject/body have no identifiers', () => {
    const buf = makeXlsx([
      ['Tarifs FoodFlow — Restaurant: TestRestoSuite (FF-12345)'],
      [''],
      ['Désignation', 'Prix HT'],
      ['Tomate', '3,20'],
    ]);
    const r = matchRestaurant({
      email: { subject: 'Mercuriale', text: '', from: 'julie@foodflow.com' },
      excelBuffer: buf,
      lookups: {
        byExternalId: (id) => id === 'FF-12345' ? { restaurantId: 7, supplierId: 33 } : null,
        byEmail: () => null,
        byName: (n) => n === 'TestRestoSuite' ? { restaurantId: 7 } : null,
      },
    });
    // name comes first now
    expect(r.restaurantId).toBe(7);
    expect(r.matchedBy).toBe('name');
  });

  test('exposes Fournisseur column values in identifiers.supplierNames', () => {
    const buf = makeXlsx([
      ['Désignation', 'Fournisseur', 'Prix HT'],
      ['Tomate', 'Foodflow', '3,20'],
    ]);
    const r = matchRestaurant({
      email: { subject: 'Mercuriale', text: '', from: 'noone@x.com' },
      excelBuffer: buf,
      lookups: EMPTY_LOOKUPS,
    });
    expect(r.identifiers.supplierNames).toEqual(['Foodflow']);
  });

  test('skips empty/missing fields without crashing', () => {
    const r = matchRestaurant({
      email: {},
      lookups: EMPTY_LOOKUPS,
    });
    expect(r.restaurantId).toBeNull();
  });
});
