import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { vendorMe, type VendorMe } from '@repo/db/vendor';
import { isLanguage, t, type Language, type MessageKey } from '@repo/shared/vendor';

import { supabase } from '@/lib/supabase';
import { useQuery } from '@/lib/use-query';

const LANG_KEY = 'iwc_vendor_lang';

type VendorState = {
  me: VendorMe | undefined;
  lang: Language;
  setLang: (lang: Language) => void;
  /** The vendor's words in the chosen language (@repo/shared/vendor). */
  w: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const VendorContext = createContext<VendorState>({ me: undefined, lang: 'hi', setLang: () => undefined, w: (k) => k });

/**
 * Vendor mode's shared state (D-102): the shop (vendor_me, its own only) and the screens' language: the switch's
 * choice (kept on the phone), else the account's language, else Hindi.
 */
export function VendorProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { data: me } = useQuery('vendor:me', () => vendorMe(supabase));
  const [chosen, setChosen] = useState<Language | null>(null);
  useEffect(() => {
    void AsyncStorage.getItem(LANG_KEY).then((v) => {
      if (isLanguage(v)) setChosen(v);
    });
  }, []);
  const setLang = useCallback((lang: Language) => {
    setChosen(lang);
    void AsyncStorage.setItem(LANG_KEY, lang);
  }, []);
  const lang: Language = chosen ?? (isLanguage(me?.language) ? me.language : 'hi');
  const value = useMemo<VendorState>(
    () => ({ me, lang, setLang, w: (key, vars) => t(lang, key, vars) }),
    [me, lang, setLang],
  );
  return <VendorContext.Provider value={value}>{children}</VendorContext.Provider>;
}

export function useVendor(): VendorState {
  return useContext(VendorContext);
}
