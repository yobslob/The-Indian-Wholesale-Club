'use client';

/** Prints the order's invoice A (D-140, F4): the page prints only the invoice (globals.css, .invoice-print). */
export function PrintInvoiceButton(): React.JSX.Element {
  return (
    <button type="button" onClick={() => window.print()} className="font-ui text-ink min-h-11 text-sm font-semibold underline print:hidden">
      Print or save your invoice
    </button>
  );
}
