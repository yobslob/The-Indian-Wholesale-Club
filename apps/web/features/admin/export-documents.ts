/**
 * The export's documents (flows.md §6.1), built from the cycle's picked pieces. Pure, so they have unit tests
 * (tests/export-documents.test.ts). Admin-only: the packing list names the shop each piece came from.
 *
 * The commercial invoice lists the goods only. Who exports and imports, the HS codes, the value to declare and the
 * Incoterms are not decided (TODO(founder): Q-30), so those fields stay blank and say so; nothing is guessed.
 */

export interface ExportLine {
  quantity: number;
  shop_price_paise: number | null;
  vendor: { shop_name: string } | null;
  variant: {
    sku: string;
    label: string;
    weight_g: number | null;
    product: {
      name: string;
      product_type: string;
      attributes: unknown;
      region: { name: string } | null;
      category: { name: string } | null;
    } | null;
  } | null;
  item: { order: { order_number: string } | null } | null;
}

export type Row = (string | number)[];

const attr = (attributes: unknown, key: string): string => {
  const value = (attributes as Record<string, unknown> | null)?.[key];
  return typeof value === 'string' ? value : '';
};

/** One row per piece line: what goes in the box, for whom, from which shop (internal). */
export function packingListRows(lines: ExportLine[]): Row[] {
  const sorted = [...lines].sort((a, b) =>
    (a.item?.order?.order_number ?? '').localeCompare(b.item?.order?.order_number ?? ''),
  );
  return [
    ['Order', 'SKU', 'Item', 'Variant', 'Pieces', 'Weight each (g)', 'Shop'],
    ...sorted.map((l) => [
      l.item?.order?.order_number ?? '',
      l.variant?.sku ?? '',
      l.variant?.product?.name ?? '',
      l.variant?.label ?? '',
      l.quantity,
      l.variant?.weight_g ?? '',
      l.vendor?.shop_name ?? '',
    ]),
  ];
}

/**
 * The goods, grouped by item and variant: description, fabric, origin, pieces, weight and the shop price paid in ₹
 * (and in $ at the cycle's exchange rate, when it is set). The header fields of Q-30 are marked, not filled.
 */
export function invoiceRows(lines: ExportLine[], fxInrPerUsd: number | null): Row[] {
  const groups = new Map<string, { line: ExportLine; pieces: number }>();
  for (const l of lines) {
    const key = l.variant?.sku ?? '';
    const g = groups.get(key);
    if (g) g.pieces += l.quantity;
    else groups.set(key, { line: l, pieces: l.quantity });
  }
  const blank = 'TO FILL (Q-30)';
  let totalPaise = 0;
  let totalGrams = 0;
  const body = [...groups.values()].map(({ line, pieces }) => {
    const p = line.variant?.product;
    const unitPaise = line.shop_price_paise ?? 0;
    totalPaise += unitPaise * pieces;
    totalGrams += (line.variant?.weight_g ?? 0) * pieces;
    return [
      `${p?.name ?? ''} (${line.variant?.label ?? ''})`,
      p?.category?.name ?? '',
      attr(p?.attributes, 'fibre_content'),
      blank,
      `India (${p?.region?.name ?? ''})`,
      pieces,
      line.variant?.weight_g ? line.variant.weight_g * pieces : '',
      (unitPaise / 100).toFixed(2),
      ((unitPaise * pieces) / 100).toFixed(2),
      fxInrPerUsd ? ((unitPaise * pieces) / 100 / fxInrPerUsd).toFixed(2) : '',
    ];
  });
  return [
    ['Exporter of record', blank],
    ['Consignee / importer of record', blank],
    ['Incoterms', blank],
    ['Value declared', `${blank}: shown below is the shop price paid`],
    [],
    ['Description', 'Category', 'Fabric', 'HS code', 'Origin', 'Pieces', 'Weight (g)', 'Unit ₹', 'Total ₹', 'Total $'],
    ...body,
    [
      'Total',
      '',
      '',
      '',
      '',
      lines.reduce((n, l) => n + l.quantity, 0),
      totalGrams || '',
      '',
      (totalPaise / 100).toFixed(2),
      fxInrPerUsd ? (totalPaise / 100 / fxInrPerUsd).toFixed(2) : '',
    ],
  ];
}

/** RFC 4180: fields with a comma, quote or line break are quoted, quotes doubled. CRLF between rows. */
export function toCsv(rows: Row[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const text = String(cell);
          return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
        })
        .join(','),
    )
    .join('\r\n');
}
