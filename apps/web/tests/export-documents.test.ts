import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { invoiceRows, packingListRows, toCsv, type ExportLine } from '../features/admin/export-documents';

const line = (order: string, sku: string, qty: number, paise: number): ExportLine => ({
  quantity: qty,
  shop_price_paise: paise,
  vendor: { shop_name: 'Shop, "Main" Road' },
  variant: {
    sku,
    label: 'Cream',
    weight_g: 600,
    product: {
      name: 'Kasavu saree',
      product_type: 'clothing',
      attributes: { fibre_content: '100% cotton' },
      region: { name: 'Kerala' },
      category: { name: 'Sarees' },
    },
  },
  item: { order: { order_number: order } },
});

const lines = [line('IWC-2', 'KAS-1', 1, 250000), line('IWC-1', 'KAS-1', 2, 250000)];

describe('export documents (flows.md §6.1)', () => {
  it('packing list: one row per line, by order, with the shop', () => {
    const rows = packingListRows(lines);
    assert.deepEqual(rows[1], ['IWC-1', 'KAS-1', 'Kasavu saree', 'Cream', 2, 600, 'Shop, "Main" Road']);
    assert.equal(rows.length, 3);
  });

  it('invoice: groups pieces of one variant, totals ₹ and $ at the cycle rate, origin India with the state', () => {
    const rows = invoiceRows(lines, 83.5);
    const goods = rows.find((r) => r[0] === 'Kasavu saree (Cream)');
    assert.deepEqual(goods, [
      'Kasavu saree (Cream)', 'Sarees', '100% cotton', 'TO FILL (Q-30)', 'India (Kerala)', 3, 1800, '2500.00', '7500.00', '89.82',
    ]);
    assert.deepEqual(rows.at(-1), ['Total', '', '', '', '', 3, 1800, '', '7500.00', '89.82']);
  });

  it('invoice: never guesses the undecided fields, and leaves $ empty without an exchange rate', () => {
    const rows = invoiceRows(lines, null);
    assert.equal(rows[0]?.[1], 'TO FILL (Q-30)');
    assert.equal(rows.at(-1)?.[9], '');
    assert.equal(JSON.stringify(rows).includes('Shop'), false, 'the invoice never names the shop (D-003)');
  });

  it('CSV quotes commas and quotes', () => {
    assert.equal(toCsv([['a,b', 'say "hi"', 3]]), '"a,b","say ""hi""",3');
  });
});
