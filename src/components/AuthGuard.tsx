import { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';
import type { Session, User } from '@supabase/supabase-js';

type AdminCheckStatus = 'authorized' | 'unauthorized' | 'error';

export function AuthGuard() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [networkError, setNetworkError] = useState(false);
  const [showFailsafeAction, setShowFailsafeAction] = useState(false);
  const isMountedRef = useRef(true);

  const checkUserAdmin = useCallback(async (user: User): Promise<AdminCheckStatus> => {
    const TIMEOUT = Symbol('timeout');
    const withTimeout = <T,>(p: PromiseLike<T>, ms: number) =>
      Promise.race([Promise.resolve(p), new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), ms))]);

    try {
      // Primary check: Execute secure server-side RPC is_admin()
      const rpcResult = await withTimeout(supabase.rpc('is_admin'), 8000);
      if (rpcResult !== TIMEOUT && !rpcResult.error && typeof rpcResult.data === 'boolean') {
        return rpcResult.data ? 'authorized' : 'unauthorized';
      }

      // Fallback check: Direct query to admin_users table under authenticated session
      const queryResult = await withTimeout(
        supabase
          .from('admin_users')
          .select('id, user_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        8000
      );

      if (queryResult === TIMEOUT || queryResult.error) {
        return 'error';
      }

      return queryResult.data ? 'authorized' : 'unauthorized';
    } catch {
      return 'error';
    }
  }, []);

  const verifySession = useCallback(
    async (session: Session | null) => {
      if (!isMountedRef.current) return;

      if (!session || !session.user) {
        setCurrentUser(null);
        setIsAdmin(false);
        setNetworkError(false);
        setLoading(false);
        return;
      }

      const user = session.user;
      setCurrentUser(user);

      // Verify admin authorization
      const status = await checkUserAdmin(user);

      if (!isMountedRef.current) return;

      if (status === 'authorized') {
        setIsAdmin(true);
        setAuthError('');
        setNetworkError(false);
      } else if (status === 'error') {
        // Transient timeout or network error: do NOT sign out a valid admin session.
        setNetworkError(true);
        setShowFailsafeAction(true);
      } else {
        // Explicitly unauthorized: revoke session immediately
        try {
          localStorage.removeItem('ewumate_admin_auth');
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        setIsAdmin(false);
        setCurrentUser(null);
        setNetworkError(false);
        setAuthError('Access Denied: You do not have administrator permissions to access this console.');
      }
      setLoading(false);
    },
    [checkUserAdmin]
  );

  useEffect(() => {
    isMountedRef.current = true;

    // Show manual retry/reset actions if verification takes longer than 3 seconds
    const actionTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setShowFailsafeAction(true);
      }
    }, 3000);

    // 1. Initial session check with timeout protection against deadlocks
    const init = async () => {
      try {
        const TIMEOUT = Symbol('timeout');
        const res = await Promise.race([
          supabase.auth.getSession(),
          new Promise<typeof TIMEOUT>((resolve) => setTimeout(() => resolve(TIMEOUT), 6000)),
        ]);

        if (res === TIMEOUT) {
          if (isMountedRef.current) {
            setNetworkError(true);
            setShowFailsafeAction(true);
            setLoading(false);
          }
          return;
        }

        await verifySession(res.data?.session ?? null);
      } catch (err: unknown) {
        if (isMountedRef.current) {
          setCurrentUser(null);
          setIsAdmin(false);
          setAuthError(err instanceof Error ? err.message : 'Authentication error occurred.');
          setLoading(false);
        }
      }
    };

    init();

    // 2. Synchronous auth state listener to avoid Web Lock deadlock
    // IMPORTANT: DO NOT use an async callback inside onAuthStateChange!
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        return;
      }

      if (event === 'SIGNED_OUT' || !session) {
        if (isMountedRef.current) {
          setCurrentUser(null);
          setIsAdmin(false);
          setNetworkError(false);
          setLoading(false);
        }
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Defer outside the Supabase onAuthStateChange lock via setTimeout
        setTimeout(() => {
          verifySession(session);
        }, 0);
      }
    });

    return () => {
      isMountedRef.current = false;
      clearTimeout(actionTimer);
      subscription.unsubscribe();
    };
  }, [verifySession]);

  const handleForceReset = async () => {
    try {
      localStorage.removeItem('ewumate_admin_auth');
      await supabase.auth.signOut();
    } catch {
      // ignore
    } finally {
      window.location.href = '/login';
    }
  };

  if (loading || networkError) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4 text-center">
        {loading ? <Loader2 className="w-8 h-8 text-primary animate-spin" /> : null}
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {networkError ? 'Unable to verify admin session' : 'Verifying security credentials...'}
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            {networkError
              ? 'Check your network connection and retry. Your session was not cleared.'
              : 'Validating encrypted session and administrative role'}
          </p>
        </div>

        {(showFailsafeAction || networkError) && (
          <div className="mt-4 flex flex-col items-center gap-2 animate-in fade-in duration-300">
            <p className="text-xs text-amber-500 font-medium">
              Verification is taking longer than expected.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Retry
              </button>
              <button
                type="button"
                onClick={handleForceReset}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
                Reset & Go to Login
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (authError && !isAdmin) {
    return <Navigate to="/login" state={{ error: authError }} replace />;
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
