import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabase';
import { clearQueryCache } from './use-query';

import type { Session } from '@supabase/supabase-js';

interface AuthState {
  /** False until the stored session (if any) has been read. */
  ready: boolean;
  session: Session | null;
  /**
   * Server-confirmed admin (D-006): the database's is_admin() = role 'admin' AND the
   * email in admin_emails. Never decided on the phone; the UI only reflects it.
   */
  isAdmin: boolean;
  /** Server-confirmed vendor account (D-102): is_vendor() = role 'vendor' AND an active account. */
  isVendor: boolean;
}

interface SessionState extends AuthState {
  /** An admin browsing the customer tabs ("View the store"); resets on every sign-in. */
  viewingStore: boolean;
  setViewingStore: (value: boolean) => void;
}

const SessionContext = createContext<SessionState>({
  ready: false,
  session: null,
  isAdmin: false,
  isVendor: false,
  viewingStore: false,
  setViewingStore: () => undefined,
});

async function checkRole(session: Session | null): Promise<{ isAdmin: boolean; isVendor: boolean }> {
  if (!session) return { isAdmin: false, isVendor: false };
  const [admin, vendor] = await Promise.all([supabase.rpc('is_admin'), supabase.rpc('is_vendor')]);
  return { isAdmin: !admin.error && admin.data === true, isVendor: !vendor.error && vendor.data === true };
}

/** One sign-in screen for everyone; admin mode and vendor mode appear only when the server says so (admin.md, vendor.md). */
export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>({ ready: false, session: null, isAdmin: false, isVendor: false });
  const [viewingStore, setViewingStore] = useState(false);

  useEffect(() => {
    let active = true;
    const apply = async (session: Session | null) => {
      clearQueryCache(); // another person's screens (orders, addresses) never show from memory
      const roles = await checkRole(session);
      if (!active) return;
      setAuth({ ready: true, session, ...roles });
      setViewingStore(false);
    };
    void supabase.auth.getSession().then(({ data }) => apply(data.session));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED')
        void apply(session);
      else if (active) setAuth((prev) => ({ ...prev, session }));
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({ ...auth, viewingStore, setViewingStore }), [auth, viewingStore]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
