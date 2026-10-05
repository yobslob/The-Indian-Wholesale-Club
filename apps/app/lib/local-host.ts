/**
 * Development on a phone: the local Supabase and the website run on the computer, whose LAN address changes with the
 * network (home Wi-Fi, a hotspot…). An address in apps/app/.env that points at this computer (localhost or a private
 * LAN address) is swapped for the address Metro is served from, which the phone has just reached. Anything else (a
 * hosted Supabase, a public URL) is left alone. Pure, so it has unit tests (tests/local-host.test.ts).
 */

const PRIVATE_IPV4 = /^(10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$/;
const isLocal = (host: string): boolean =>
  host === 'localhost' || host === '127.0.0.1' || PRIVATE_IPV4.test(host);

/** `metroHostUri` is Expo's `hostUri`, e.g. "10.153.78.5:8081". */
export function followMetroHost(url: string | undefined, metroHostUri: string | null | undefined): string | undefined {
  const metroHost = metroHostUri?.split(':')[0] ?? '';
  if (!url || !PRIVATE_IPV4.test(metroHost)) return url;
  const match = /^(https?:\/\/)([^/:]+)(.*)$/.exec(url);
  if (!match || !isLocal(match[2] ?? '')) return url;
  return `${match[1]}${metroHost}${match[3]}`;
}
