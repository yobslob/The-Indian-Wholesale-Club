/**
 * The web preview only (engineering.md §App specifics): SecureStore has no web version, and the static render runs
 * in Node with no localStorage, so sessions live in localStorage when there is one and nowhere otherwise.
 */
type KeyValue = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};
const local = (): KeyValue | undefined => (globalThis as { localStorage?: KeyValue }).localStorage;

export const authStorage = {
  getItem: async (key: string) => local()?.getItem(key) ?? null,
  setItem: async (key: string, value: string) => local()?.setItem(key, value),
  removeItem: async (key: string) => local()?.removeItem(key),
};
