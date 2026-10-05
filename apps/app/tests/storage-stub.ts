/**
 * Unit tests run in Node, where AsyncStorage falls back to the browser's localStorage. A small in-memory stand-in,
 * imported before the code under test, so the persisted bag (B-16) can be tested without a phone.
 */
const memory = new Map<string, string>();
const localStorage = {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => void memory.set(key, value),
  removeItem: (key: string) => void memory.delete(key),
  clear: () => memory.clear(),
  key: (i: number) => [...memory.keys()][i] ?? null,
  get length() {
    return memory.size;
  },
};
(globalThis as unknown as { window: { localStorage: typeof localStorage } }).window = { localStorage };

export { memory as storedValues };
