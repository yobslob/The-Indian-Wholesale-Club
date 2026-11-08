import { create } from 'zustand';

/** The main photo's `sizes`, shared by the gallery and the chips that load its next photo ahead. */
export const GALLERY_MAIN_SIZES = '(min-width: 1100px) 40vw, (min-width: 768px) 52vw, 100vw';

interface LookState {
  /** The look picked on each open product page; not kept across visits. */
  looks: Record<string, string>;
  setLook: (productId: string, look: string) => void;
  clearLook: (productId: string) => void;
}

/** The gallery and the picker are siblings on the server page, so the picked look lives here (D-194). */
export const useLook = create<LookState>((set) => ({
  looks: {},
  setLook: (productId, look) => set((s) => ({ looks: { ...s.looks, [productId]: look } })),
  clearLook: (productId) =>
    set((s) => ({ looks: Object.fromEntries(Object.entries(s.looks).filter(([id]) => id !== productId)) })),
}));
