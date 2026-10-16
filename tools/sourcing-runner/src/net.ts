import { lookup as systemLookup } from 'node:dns';
import https from 'node:https';

import { log } from './log';

import type { LookupFunction } from 'node:net';

/**
 * The runner's road to Supabase. Indian ISPs have answered `*.supabase.co` wrongly at the DNS level before (Jio,
 * Airtel and ACT, early 2026), which Node shows only as "fetch failed". So: the normal fetch first; if it cannot
 * connect, the host is looked up over HTTPS at Cloudflare or Google (by IP address, no DNS needed) and the request is
 * sent there, for the rest of the run.
 */

/** "fetch failed (ENOTFOUND hfx….supabase.co)" instead of a bare "fetch failed". */
export function describeNetError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = (error as Error & { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as Error & { code?: string }).code;
    return `${error.message} (${[code, cause.message].filter(Boolean).join(': ')})`;
  }
  return error.message;
}

/** Node's fetch reports every failure to connect (DNS, refused, reset, a wrong certificate) as this TypeError. */
function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError && /fetch failed/i.test(error.message);
}

const RESOLVERS = [
  (host: string) => `https://1.1.1.1/dns-query?name=${encodeURIComponent(host)}&type=A`,
  (host: string) => `https://8.8.8.8/resolve?name=${encodeURIComponent(host)}&type=A`,
];
const cache = new Map<string, { ips: string[]; until: number }>();

/** The host's IPv4 addresses from a public DNS-over-HTTPS resolver. */
export async function resolveOverHttps(host: string): Promise<string[]> {
  const hit = cache.get(host);
  if (hit && hit.until > Date.now()) return hit.ips;
  let lastError: unknown = null;
  for (const url of RESOLVERS) {
    try {
      const res = await fetch(url(host), {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(8000),
      });
      const body = (await res.json()) as { Answer?: { type: number; data: string; TTL: number }[] };
      const answers = (body.Answer ?? []).filter((a) => a.type === 1);
      if (answers.length) {
        const ips = answers.map((a) => a.data);
        const ttl = Math.max(60, Math.min(...answers.map((a) => a.TTL)));
        cache.set(host, { ips, until: Date.now() + ttl * 1000 });
        return ips;
      }
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`no address for ${host} from public DNS (${describeNetError(lastError)})`);
}

const httpsLookup: LookupFunction = (hostname, options, callback) => {
  resolveOverHttps(hostname).then(
    (ips) => {
      if (options.all)
        callback(
          null,
          ips.map((address) => ({ address, family: 4 })),
        );
      else callback(null, ips[0]!, 4);
    },
    // public DNS unreachable too: let the system try, so its own error is the one shown
    () => systemLookup(hostname, options, callback as never),
  );
};

async function bodyBytes(body: unknown): Promise<Buffer | null> {
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return Buffer.from(body);
  if (body instanceof URLSearchParams) return Buffer.from(body.toString());
  if (body instanceof ArrayBuffer) return Buffer.from(body);
  if (ArrayBuffer.isView(body)) return Buffer.from(body.buffer, body.byteOffset, body.byteLength);
  if (body instanceof Blob) return Buffer.from(await body.arrayBuffer());
  throw new Error('unsupported request body');
}

function plainHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** fetch over node:https with the public-DNS lookup (the runner's requests: JSON and photo bytes). */
export async function fetchViaPublicDns(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<Response> {
  const request = input instanceof Request ? input : null;
  const url = new URL(request ? request.url : input.toString());
  const headers = new Headers(init?.headers ?? request?.headers);
  const body = await bodyBytes(init?.body ?? (request?.body ? await request.arrayBuffer() : null));
  if (body) headers.set('content-length', String(body.length));
  const signal = init?.signal ?? request?.signal ?? null;
  return new Promise<Response>((resolve, reject) => {
    const req = https.request(
      {
        hostname: url.hostname,
        port: url.port || 443,
        path: `${url.pathname}${url.search}`,
        method: init?.method ?? request?.method ?? 'GET',
        headers: plainHeaders(headers),
        lookup: httpsLookup,
        servername: url.hostname,
        timeout: 60_000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(c));
        res.on('error', reject);
        res.on('end', () => {
          const out = new Headers();
          for (const [k, v] of Object.entries(res.headers)) {
            if (Array.isArray(v)) v.forEach((x) => out.append(k, x));
            else if (v !== undefined) out.set(k, String(v));
          }
          const status = res.statusCode ?? 500;
          const empty = status === 204 || status === 304 || (init?.method ?? 'GET') === 'HEAD';
          resolve(
            new Response(empty ? null : Buffer.concat(chunks), {
              status,
              statusText: res.statusMessage ?? '',
              headers: out,
            }),
          );
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
    signal?.addEventListener('abort', () => req.destroy(new Error('aborted')), { once: true });
    if (body) req.write(body);
    req.end();
  });
}

let viaPublicDns = false;

/** The fetch Supabase uses: normal first, public DNS once the normal road has failed to connect. */
export const supabaseFetch: typeof fetch = async (input, init) => {
  if (viaPublicDns) return fetchViaPublicDns(input, init);
  try {
    return await fetch(input, init);
  } catch (error) {
    if (!isNetworkFailure(error)) throw error;
    viaPublicDns = true;
    log(
      `Supabase did not answer through this network's DNS (${describeNetError(error)}); using public DNS for this run.`,
    );
    return fetchViaPublicDns(input, init);
  }
};
