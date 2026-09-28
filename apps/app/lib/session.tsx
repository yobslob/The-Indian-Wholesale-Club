import { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { supabase } from './supabase';

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
  viewingStore: false,
  setViewingStore: () => undefined,
});

async function checkAdmin(session: Session | null): Promise<boolean> {
  if (!session) return false;
  const { data, error } = await supabase.rpc('is_admin');
  return !error && data === true;
}

/** One sign-in screen for everyone; admin mode appears only when the server says so (admin.md). */
export function SessionProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [auth, setAuth] = useState<AuthState>({ ready: false, session: null, isAdmin: false });
  const [viewingStore, setViewingStore] = useState(false);

  useEffect(() => {
    let active = true;
    const apply = async (session: Session | null) => {
      const isAdmin = await checkAdmin(session);
      if (!active) return;
      setAuth({ ready: true, session, isAdmin });
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
