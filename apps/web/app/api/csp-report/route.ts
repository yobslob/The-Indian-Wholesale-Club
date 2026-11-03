import { z } from 'zod';

import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit-memory';

const MAX_BODY = 16_000;
const MAX_REPORTS = 5;
// Per server instance, for everyone together: a broken page reports on every view, and the logs only need a sample.
const RULE = { limit: 60, windowMs: 60_000 };
const none = (): Response => new Response(null, { status: 204 });

const text = z.string().nullish().transform((v) => v?.slice(0, 400) ?? undefined);
const num = z.number().nullish().transform((v) => v ?? undefined);
/** report-uri (Firefox, Safari): one report, kebab-case names. */
const legacyReport = z.object({
  'csp-report': z.object({
    'document-uri': text,
    'blocked-uri': text,
    'effective-directive': text,
    'violated-directive': text,
    'source-file': text,
    'line-number': num,
  }),
});
/** report-to (Chrome, Edge): the Reporting API's list. */
const reportingList = z.array(
  z.object({
    type: z.string(),
    body: z.object({
      documentURL: text,
      blockedURL: text,
      effectiveDirective: text,
      sourceFile: text,
      lineNumber: num,
    }),
  }),
);

interface Violation {
  directive?: string;
  blocked?: string;
  page?: string;
  source?: string;
  line?: number;
}

/** A URL as its origin and path only (no query: it can hold an email or an order number); keywords stay. */
function short(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`.slice(0, 200);
  } catch {
    return value.slice(0, 60);
  }
}

function violations(body: unknown): Violation[] {
  const one = legacyReport.safeParse(body);
  if (one.success) {
    const r = one.data['csp-report'];
    const directive = r['effective-directive'] ?? r['violated-directive'];
    return [{ directive, blocked: r['blocked-uri'], page: r['document-uri'], source: r['source-file'], line: r['line-number'] }];
  }
  const list = reportingList.safeParse(body);
  if (!list.success) return [];
  return list.data
    .filter((r) => r.type === 'csp-violation')
    .map(({ body: b }) => ({
      directive: b.effectiveDirective,
      blocked: b.blockedURL,
      page: b.documentURL,
      source: b.sourceFile,
      line: b.lineNumber,
    }));
}

/**
 * E-3: where browsers report a Content-Security-Policy violation (next.config.js `report-uri` / `report-to`). Each is
 * logged as one short warning line (the directive, what was blocked, the page's path; never a query string), so a
 * blocked Stripe frame (a blank payment step) shows in the logs. Nothing is stored or read back: always 204.
 */
export async function POST(request: Request): Promise<Response> {
  if (!rateLimit('csp-report', RULE).ok) return none();
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return none();
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return none();
    body = JSON.parse(raw);
  } catch {
    return none();
  }
  for (const v of violations(body).slice(0, MAX_REPORTS)) {
    logger.warn('csp.violation', {
      directive: v.directive?.slice(0, 40),
      blocked: short(v.blocked),
      page: short(v.page)?.replace(/^https?:\/\/[^/]+/, ''),
      source: short(v.source),
      line: v.line,
    });
  }
  return none();
}
