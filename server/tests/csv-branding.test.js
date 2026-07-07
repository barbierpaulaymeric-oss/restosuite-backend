'use strict';

// CSV formula-injection (CWE-1236) regression guard. Tenant-editable free text
// (supplier/recipe/ingredient names) must never reach a spreadsheet cell that a
// leading =,+,-,@ turns into an executable formula.

const { csvCell } = require('../lib/csv-branding');

describe('csvCell neutralizes formula triggers', () => {
  test.each([
    ['=1+1', "'=1+1"],
    ['=HYPERLINK("http://evil","x")', '"\'=HYPERLINK(""http://evil"",""x"")"'],
    ['+cmd', "'+cmd"],
    ['-2+3', "'-2+3"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tTabbed', "'\tTabbed"],
  ])('prefixes a quote before %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  test('leaves benign values untouched', () => {
    expect(csvCell('Tomates')).toBe('Tomates');
    expect(csvCell('12.50')).toBe('12.50');
    expect(csvCell('Fournisseur Métro')).toBe('Fournisseur Métro');
  });

  test('still quotes separators/quotes after neutralizing', () => {
    // leading = AND an embedded ; → both neutralized and quoted
    expect(csvCell('=a;b')).toBe('"\'=a;b"');
  });

  test('null/undefined become empty string', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});
