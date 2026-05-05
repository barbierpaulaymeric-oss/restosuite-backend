'use strict';

// Pure unit tests for the restaurant-identification logic that runs before
// supplier resolution. Inputs are POJOs + lookup callbacks so no IMAP/DB
// is needed.

const xlsx = require('xlsx');
const {
  extractIdentifiers,
  extractExcelBannerText,
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

// ─── matchRestaurant ─────────────────────────────────────────────────

describe('matchRestaurant', () => {
  const EMPTY_LOOKUPS = {
    byExternalId: () => null,
    byEmail: () => null,
    byName: () => null,
  };

  test('returns null when nothing matches', () => {
    const r = matchRestaurant({
      email: { subject: 'Hello', text: 'no identifiers here', from: 'x@y.com' },
      lookups: EMPTY_LOOKUPS,
    });
    expect(r).toBeNull();
  });

  test('matches by external_id (FoodFlow) — priority 1', () => {
    const r = matchRestaurant({
      email: {
        subject: 'Mercuriale FF-12345',
        text: 'Restaurant: TestRestoSuite, contact: chef@x.com',
        from: 'julie@foodflow.com',
      },
      lookups: {
        byExternalId: (id) => id === 'FF-12345' ? { restaurantId: 7, supplierId: 33 } : null,
        byEmail: () => ({ restaurantId: 9 }),
        byName: () => ({ restaurantId: 11 }),
      },
    });
    expect(r).toEqual({
      restaurantId: 7,
      supplierId: 33,
      matchedBy: 'external_id',
      matchedValue: 'FF-12345',
    });
  });

  test('matches by accounts email — priority 2 when no external_id hit', () => {
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
    expect(r).toEqual({
      restaurantId: 7,
      matchedBy: 'email',
      matchedValue: 'barbierpaulaymeric@gmail.com',
    });
  });

  test('matches by restaurant name — priority 3 when no external_id and no email', () => {
    const r = matchRestaurant({
      email: {
        subject: 'Mercuriale',
        text: 'Restaurant: TestRestoSuite',
        from: 'julie@foodflow.com',
      },
      lookups: {
        byExternalId: () => null,
        byEmail: () => null,
        byName: (n) => n === 'TestRestoSuite' ? { restaurantId: 7 } : null,
      },
    });
    expect(r).toEqual({
      restaurantId: 7,
      matchedBy: 'name',
      matchedValue: 'TestRestoSuite',
    });
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
        byName: () => null,
      },
    });
    expect(r).toEqual({
      restaurantId: 7,
      supplierId: 33,
      matchedBy: 'external_id',
      matchedValue: 'FF-12345',
    });
  });

  test('skips empty/missing fields without crashing', () => {
    const r = matchRestaurant({
      email: {},
      lookups: EMPTY_LOOKUPS,
    });
    expect(r).toBeNull();
  });
});
