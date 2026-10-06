/**
 * The export's documents (flows.md §6.1), built from the cycle's picked pieces. Pure, so they have unit tests
 * (tests/export-documents.test.ts). Admin-only: the packing list names the shop each piece came from.
 *
 * The commercial invoice's header (exporter, importer of record, Incoterm, broker, forwarder) and HS codes come from
 * Settings → Business and compliance details (D-074). A detail still a placeholder says so; one missing says where to
 * fill it. Nothing is guessed.
 */

/** business_details rows by key: the value and whether it is still a placeholder. */
export type InvoiceDetails = Record<string, { value: string; is_placeholder: boolean }>;

const MISSING = 'TO FILL (Settings → Business and compliance details)';

/** The rows of listBusinessDetails, by key. */
export function detailsByKey(rows: { key: string; value: string; is_placeholder: boolean }[]): InvoiceDetails {
  return Object.fromEntries(rows.map((r) => [r.key, { value: r.value, is_placeholder: r.is_placeholder }]));
}

function detail(details: InvoiceDetails, key: string): string {
  const d = details[key];
  if (!d || !d.value.trim() || d.value.trim() === 'TO FILL') return MISSING;
  return d.is_placeholder ? `${d.value} (placeholder)` : d.value;
}

function joined(details: InvoiceDetails, parts: [string, string][]): string {
  const values = parts.map(([key, label]) => [label, detail(details, key)] as const);
  if (values.every(([, v]) => v === MISSING)) return MISSING;
  return values.map(([label, v]) => (label ? `${label} ${v}` : v)).join(' · ');
}

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
 * The goods, grouped by item and variant: description, fabric, HS code, origin, pieces, weight and the shop price
 * paid in ₹ (and in $ at the cycle's exchange rate, when it is set), under the header from the business details.
 */
export function invoiceRows(lines: ExportLine[], fxInrPerUsd: number | null, details: InvoiceDetails = {}): Row[] {
  const groups = new Map<string, { line: ExportLine; pieces: number }>();
  for (const l of lines) {
    const key = l.variant?.sku ?? '';
    const g = groups.get(key);
    if (g) g.pieces += l.quantity;
    else groups.set(key, { line: l, pieces: l.quantity });
  }
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
      detail(details, p?.product_type === 'spice' ? 'hs_spices' : 'hs_clothing'),
      `India (${p?.region?.name ?? ''})`,
      pieces,
      line.variant?.weight_g ? line.variant.weight_g * pieces : '',
      (unitPaise / 100).toFixed(2),
      ((unitPaise * pieces) / 100).toFixed(2),
      fxInrPerUsd ? ((unitPaise * pieces) / 100 / fxInrPerUsd).toFixed(2) : '',
    ];
  });
  return [
    [
      'Exporter of record',
      joined(details, [['exporter_name', ''], ['exporter_address', ''], ['exporter_iec', 'IEC'], ['exporter_gstin', 'GSTIN']]),
    ],
    [
      'Consignee / importer of record',
      joined(details, [['importer_name', ''], ['importer_address', ''], ['importer_ein', 'EIN'], ['customs_bond', 'Bond']]),
    ],
    ['Incoterms', detail(details, 'incoterm')],
    ['Customs broker', detail(details, 'customs_broker')],
    ['Forwarder', detail(details, 'forwarder')],
    ['Value', 'the shop price paid, below'],
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
