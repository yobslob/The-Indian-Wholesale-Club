/**
 * Server error tracking without a paid service (launch QA F-4): what instrumentation.ts's onRequestError sends to the
 * founder. Only the route's pattern (`/states/[region]/[product]`, never the real path or its query, which may hold an
 * order number or an email), the method, the error's digest (the id Next shows on the error page and logs) and the
 * release. Never the request's body, headers, cookies or the error's message (it can quote customer data).
 */

export interface RequestErrorAlert {
  /** One alert per route pattern and kind per 10 minutes (lib/alert.ts sendThrottledAlert). */
  key: string;
  title: string;
  fields: Record<string, string>;
}

export interface RequestErrorInput {
  error: unknown;
  method: string;
  routePath: string;
  routeType: string;
  release: string | undefined;
}

function digestOf(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === 'string' && digest.length <= 64 ? digest : undefined;
}

/** The route pattern only: no query, no fragment, short. */
function routeOnly(routePath: string): string {
  const route = routePath.split(/[?#]/)[0] ?? '';
  return route.length > 120 ? route.slice(0, 120) : route || '/';
}

export function requestErrorAlert(input: RequestErrorInput): RequestErrorAlert {
  const route = routeOnly(input.routePath);
  const method = /^[A-Z]{3,7}$/.test(input.method) ? input.method : 'OTHER';
  const fields: Record<string, string> = { route, method, kind: input.routeType };
  const digest = digestOf(input.error);
  if (digest) fields.digest = digest;
  const errorName = input.error instanceof Error ? input.error.name : undefined;
  if (errorName && /^[A-Za-z]{1,40}$/.test(errorName)) fields.error = errorName;
  fields.release = input.release ? input.release.slice(0, 7) : 'local';
  return { key: `request:${input.routeType}:${route}`, title: `Server error on ${route}`, fields };
}
