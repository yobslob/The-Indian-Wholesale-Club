import assert from 'node:assert/strict';
import { crc32 as zlibCrc32 } from 'node:zlib';
import { describe, it } from 'node:test';

import { PRICE_SHEET_COLUMNS, priceSheetRows, sheetMargin } from '../features/admin/price-sheet';
import { buildXlsx, columnName, crc32 } from '../features/admin/xlsx';

const pickle = { name: 'Mango pickle', product_type: 'food', shop_price_paise: 18000, weight_g: 500, price_cents: 1630 } as const;

describe('Products → Download Excel (D-128)', () => {
  it('the six columns, in the founder\'s order', () => {
    assert.deepEqual(
      PRICE_SHEET_COLUMNS.map((c) => c.header),
      ['Name', 'Indian price (₹)', 'Category', 'Weight (g)', 'US price ($)', 'Margin'],
    );
    assert.deepEqual(priceSheetRows([pickle])[0]!.slice(0, 5), ['Mango pickle', 180, 'Food & Beverages', 500, 16.3]);
  });

  it('margin: what is left of the price after the subtotal, 20 / 40 / 50 within a cent', () => {
    assert.ok(Math.abs(sheetMargin(pickle)! - 0.2) < 0.001);
    const kurta = { name: 'Kurta', product_type: 'clothing', shop_price_paise: 69900, weight_g: 450, price_cents: 3037 } as const;
    assert.ok(Math.abs(sheetMargin(kurta)! - 0.4) < 0.001);
    const diya = { name: 'Diya', product_type: 'home', shop_price_paise: 35000, weight_g: 525, price_cents: 3128 } as const;
    assert.ok(Math.abs(sheetMargin(diya)! - 0.5) < 0.001);
    assert.equal(sheetMargin({ ...pickle, weight_g: null }), null, 'no weight, no margin');
  });

  it('writes a zip Excel can open: parts, CRCs, numbers as numbers, text escaped', () => {
    assert.equal(columnName(0), 'A');
    assert.equal(columnName(25), 'Z');
    assert.equal(columnName(26), 'AA');
    const sample = new TextEncoder().encode('IWC ₹');
    assert.equal(crc32(sample), zlibCrc32(sample));
    const file = buildXlsx('IWC prices', PRICE_SHEET_COLUMNS, priceSheetRows([{ ...pickle, name: 'Achaar <Aam> & co' }]));
    const text = new TextDecoder().decode(file);
    assert.equal(file[0], 0x50);
    assert.equal(file[1], 0x4b, 'a zip');
    for (const part of ['[Content_Types].xml', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml']) {
      assert.ok(text.includes(part), part);
    }
    assert.ok(text.includes('Achaar &lt;Aam&gt; &amp; co'));
    assert.ok(text.includes('<v>16.3</v>') && text.includes('<v>180</v>'));
    assert.ok(text.includes('formatCode="&quot;₹&quot;#,##0.00"'));
  });
});
