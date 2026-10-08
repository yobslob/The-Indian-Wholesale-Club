import { formatUsd } from '@repo/shared/domain';
import tokens from '@repo/tokens';

import type { OrderDetail } from '@repo/db/store';

/**
 * The customer emails' frame (D-094): the cream page, the logo as an image at the top, the message in a card with a
 * heading, Syne / Karla where the email app allows web fonts (served from our own site, so opening an email tells no
 * one else), the button in the brand colour, the pieces with small photos, and a footer with the useful links.
 * Email-safe HTML only: tables and inline styles. Pure, so it has unit tests (tests/order-email.test.ts).
 */
export interface EmailContext {
  siteName: string;
  /** The website's address, no trailing slash: the logo, fonts and footer links point there. */
  siteUrl: string;
  supportEmail: string | null;
  /** A small copy of a product photo for the email (send.ts: the site's own image resizer), from its storage path. */
  photo: (storagePath: string) => string;
}

const c = tokens.colors;
const C = {
  page: c.canvas,
  card: c.paper,
  ink: c.ink,
  muted: c['ink-muted'],
  line: c.line,
  brand: c.brand,
  onBrand: c['on-brand'],
  panel: c.surface,
  heading: '#1D1A17',
};
const HEAD = "font-family:Syne,'Helvetica Neue',Helvetica,Arial,sans-serif";
export const TEXT = "font-family:Karla,'Helvetica Neue',Helvetica,Arial,sans-serif";

export function escapeHtml(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** A paragraph of the message. `html` is already escaped by the caller. */
export function paragraph(html: string): string {
  return `<p style="margin:0 0 14px;${TEXT};font-size:16px;line-height:1.55;color:${C.ink}">${html}</p>`;
}

export function small(html: string): string {
  return `<p style="margin:18px 0 0;${TEXT};font-size:13px;line-height:1.5;color:${C.muted}">${html}</p>`;
}

/** The brand-colour button (a table, so Outlook draws it too). */
export function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 4px"><tr><td style="background:${C.brand};border-radius:999px"><a href="${escapeHtml(href)}" style="display:inline-block;padding:14px 26px;${TEXT};font-size:15px;font-weight:600;color:${C.onBrand};text-decoration:none">${escapeHtml(label)}</a></td></tr></table>`;
}

/** The pieces with a small photo each (D-094); a piece without a photo gets a plain tile. */
export function pieces(items: OrderDetail['items'], ctx: EmailContext, opts: { prices?: boolean } = {}): string {
  const rows = items
    .map((item) => {
      const photo = item.image_path
        ? `<img src="${escapeHtml(ctx.photo(item.image_path))}" width="56" height="75" alt="" style="display:block;width:56px;height:75px;border-radius:10px;object-fit:cover;background:${C.panel}">`
        : `<div style="width:56px;height:75px;border-radius:10px;background:${C.panel}"></div>`;
      const price =
        opts.prices === false
          ? ''
          : `<td style="padding:12px 0;vertical-align:middle;text-align:right;border-bottom:1px solid ${C.line};${TEXT};font-size:15px;color:${C.ink}">${formatUsd(item.total_price_cents)}</td>`;
      return `<tr>
  <td width="70" style="padding:12px 14px 12px 0;vertical-align:middle;border-bottom:1px solid ${C.line}">${photo}</td>
  <td style="padding:12px 0;vertical-align:middle;border-bottom:1px solid ${C.line};${TEXT}"><div style="font-size:15px;font-weight:600;color:${C.ink}">${escapeHtml(item.product_name)}</div><div style="font-size:13px;color:${C.muted}">${escapeHtml(item.variant_label)} · ${escapeHtml(item.region_name)} × ${item.quantity}</div></td>
  ${price}
</tr>`;
    })
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${C.line};margin:6px 0 0">${rows}</table>`;
}

/** Totals rows [label, value], the last one bold (the total). Values are formatted, not escaped. */
export function totals(rows: [string, string][]): string {
  const last = rows.length - 1;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:10px 0 0;${TEXT};font-size:14px;color:${C.muted}">${rows
    .map(([label, value], i) =>
      i === last
        ? `<tr><td style="padding:10px 0 0;border-top:1px solid ${C.line};font-weight:700;font-size:16px;color:${C.ink}">${label}</td><td style="padding:10px 0 0;border-top:1px solid ${C.line};text-align:right;font-weight:700;font-size:16px;color:${C.ink}">${value}</td></tr>`
        : `<tr><td style="padding:3px 0">${label}</td><td style="text-align:right;color:${C.ink}">${value}</td></tr>`,
    )
    .join('')}</table>`;
}

function fontFaces(siteUrl: string): string {
  return `<style>
@font-face{font-family:Karla;font-style:normal;font-weight:400 700;src:url(${siteUrl}/email/karla.woff2) format('woff2')}
@font-face{font-family:Syne;font-style:normal;font-weight:500 600;src:url(${siteUrl}/email/syne.woff2) format('woff2')}
</style>`;
}

function footer(ctx: EmailContext): string {
  const link = (path: string, label: string): string =>
    `<a href="${escapeHtml(ctx.siteUrl + path)}" style="color:${C.ink};font-weight:600">${label}</a>`;
  return `<tr><td style="padding:22px 32px 30px">
  <p style="margin:0 0 10px;${TEXT};font-size:14px">${link('/orders/lookup', 'Track your order')}&nbsp;&nbsp;·&nbsp;&nbsp;${link('/shipping-returns', 'Shipping &amp; returns')}&nbsp;&nbsp;·&nbsp;&nbsp;${link('/contact', 'Contact')}</p>
  <p style="margin:0 0 6px;${TEXT};font-size:12px;line-height:1.5;color:${C.muted}">You're getting this because you ordered from ${escapeHtml(ctx.siteName)}. These emails are about your order only.</p>
  ${ctx.supportEmail ? `<p style="margin:0;${TEXT};font-size:12px;color:${C.muted}">Questions? <a href="mailto:${escapeHtml(ctx.supportEmail)}" style="color:${C.muted}">${escapeHtml(ctx.supportEmail)}</a></p>` : ''}
</td></tr>`;
}

/**
 * One whole email: `title` for the document, the small order line above the heading, the heading and the body
 * (already built from the pieces above). Every dynamic value reaching here is escaped by its builder.
 */
export function frame(ctx: EmailContext, parts: { title: string; orderLine: string; heading: string; body: string }): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(parts.title)}</title>${fontFaces(ctx.siteUrl)}</head>
<body style="margin:0;padding:0;background:${C.page}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px">
    <tr><td style="padding:14px 32px 22px"><a href="${escapeHtml(ctx.siteUrl)}"><img src="${escapeHtml(ctx.siteUrl)}/email/logo.png" width="234" height="46" alt="${escapeHtml(ctx.siteName)}" style="display:block;border:0;width:234px;height:46px"></a></td></tr>
    <tr><td style="background:${C.card};border-radius:22px;padding:28px 32px 26px">
      <p style="margin:0 0 6px;${TEXT};font-size:13px;color:${C.muted}">${escapeHtml(parts.orderLine)}</p>
      <h1 style="margin:0 0 16px;${HEAD};font-size:26px;line-height:1.15;font-weight:500;color:${C.heading}">${escapeHtml(parts.heading)}</h1>
      ${parts.body}
    </td></tr>
    ${footer(ctx)}
  </table>
</td></tr></table>
</body></html>`;
}
