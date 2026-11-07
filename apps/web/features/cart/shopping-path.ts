/**
 * D-192: where "Back to shopping" goes: the last store page looked at in this tab, set by the header's bag icon. The same
 * icon notices a visit to the account pages: whoever was signed in may have changed, so the saved coins are not to be trusted.
 */
const KEY = 'iwc-shopping';
const OFFERS_KEY = 'iwc-offers';
let last: string | null = null;
let whoMayHaveChanged = false;

const accountPages = /^\/(login|signup|account)(\/|$)/;
const notShopping = /^\/(cart|checkout|login|signup|account|orders|admin)(\/|$)/;

export function rememberShopping(pathname: string, search: string): void {
  if (accountPages.test(pathname)) {
    whoMayHaveChanged = true;
    try {
      sessionStorage.removeItem(OFFERS_KEY);
    } catch {
      // nothing kept
    }
  }
  if (notShopping.test(pathname)) return;
  last = `${pathname}${search}`;
  try {
    sessionStorage.setItem(KEY, last);
  } catch {
    // kept for this page's life only
  }
}

/** True once after a visit to the account pages. */
export function takeWhoChanged(): boolean {
  const changed = whoMayHaveChanged;
  whoMayHaveChanged = false;
  return changed;
}

export function shoppingPath(): string {
  if (last) return last;
  try {
    return sessionStorage.getItem(KEY) ?? '/';
  } catch {
    return '/';
  }
}
