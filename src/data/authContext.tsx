import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';
import {
  ensureProfile,
  NotInvitedError,
  type Profile,
} from './profileService';

interface AuthState {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  /** True while resolving the initial session + profile. */
  loading: boolean;
  /** Set when ensure_profile() refused the sign-in (email not on invite list). */
  notInvited: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notInvited, setNotInvited] = useState(false);

  /**
   * Called whenever the session changes. If there's a user, we run the
   * invite gate (ensure_profile). On success, we stash the profile.
   * On NotInvitedError, we flip the `notInvited` flag and sign the user
   * out — the UI will render a "not invited" screen instead of the app.
   */
  const hydrateFromSession = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      setNotInvited(false);
      return;
    }
    try {
      const p = await ensureProfile();
      setProfile(p);
      setNotInvited(false);
    } catch (err) {
      if (err instanceof NotInvitedError) {
        setProfile(null);
        setNotInvited(true);
        await supabase.auth.signOut();
      } else {
        // Unknown failure. Surface by logging; treat as unauthenticated to
        // avoid leaving the user stuck on a spinner.
        console.error('ensure_profile failed', err);
        setProfile(null);
        await supabase.auth.signOut();
      }
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (ignore) return;
      setSession(data.session);
      await hydrateFromSession(data.session);
      if (ignore) return;
      setLoading(false);
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, s) => {
      setSession(s);
      void hydrateFromSession(s);
    });
    return () => {
      ignore = true;
      sub.subscription.unsubscribe();
    };
  }, [hydrateFromSession]);

  const signInWithGoogle = useCallback(async () => {
    setNotInvited(false);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}${window.location.pathname}`,
      },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setNotInvited(false);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      loading,
      notInvited,
      signInWithGoogle,
      signOut,
    }),
    [session, profile, loading, notInvited, signInWithGoogle, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
