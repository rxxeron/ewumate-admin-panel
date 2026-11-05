import { useEffect, useState, useCallback, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Loader2, LogOut, RefreshCw } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function AuthGuard() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showFailsafeAction, setShowFailsafeAction] = useState(false);
  const isMountedRef = useRef(true);

  const checkUserAdmin = useCallback(async (user: User): Promise<boolean> => {
    try {
      const timeoutPromise = new Promise<null>((resolve) =>
        setTimeout(() => resolve(null), 3500)
      );

      // Primary check: Execute secure server-side RPC is_admin()
      const rpcPromise = supabase.rpc('is_admin');
      const rpcResult = await Promise.race([rpcPromise, timeoutPromise]);

      if (rpcResult && !rpcResult.error && typeof rpcResult.data === 'boolean') {
        return rpcResult.data;
      }

      // Fallback check: Direct query to admin_users table under authenticated session
      const queryPromise = supabase
        .from('admin_users')
        .select('id, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      const queryResult = await Promise.race([queryPromise, timeoutPromise]);

      return Boolean(queryResult && !queryResult.error && queryResult.data);
    } catch {
      return false;
    }
  }, []);

  const verifySession = useCallback(
    async (session: any) => {
      if (!isMountedRef.current) return;

      if (!session || !session.user) {
        setCurrentUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const user = session.user;
      setCurrentUser(user);

      // Verify admin authorization
      const hasAdminRights = await checkUserAdmin(user);

      if (!isMountedRef.current) return;

      if (hasAdminRights) {
        setIsAdmin(true);
        setAuthError('');
      } else {
        setIsAdmin(false);
        setAuthError(
          `Access Denied: Account '${user.email || user.id}' is authenticated, but is not authorized in the admin directory.`
        );
      }
      setLoading(false);
    },
    [checkUserAdmin]
  );

  useEffect(() => {
    isMountedRef.current = true;

    // Show manual unstick actions if verification takes longer than 2.5 seconds
    const actionTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setShowFailsafeAction(true);
      }
    }, 2500);

    // Hard absolute safety timeout: never stay in loading state longer than 4.5 seconds
    const safetyTimer = setTimeout(() => {
      if (isMountedRef.current) {
        setLoading((prev) => {
          if (prev) {
            console.warn('AuthGuard safety timeout triggered.');
            return false;
          }
          return false;
        });
      }
    }, 4500);

    // 1. Initial session check with timeout protection against deadlocks
    const init = async () => {
      try {
        const timeoutPromise = new Promise<any>((resolve) =>
          setTimeout(() => resolve({ data: { session: null } }), 3500)
        );

        const { data } = await Promise.race([
          supabase.auth.getSession(),
          timeoutPromise,
        ]);

        await verifySession(data?.session);
      } catch (err: any) {
        if (isMountedRef.current) {
          setCurrentUser(null);
          setIsAdmin(false);
          setAuthError(err?.message || 'Authentication error occurred.');
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
      clearTimeout(safetyTimer);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-4 text-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            Verifying security credentials...
          </p>
          <p className="text-[11px] text-muted-foreground/70">
            Validating encrypted session and administrative role
          </p>
        </div>

        {showFailsafeAction && (
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

  if (authError && currentUser && !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border border-destructive/30 rounded-xl p-8 shadow-xl text-center space-y-6">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">Access Restricted</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {authError}
            </p>
          </div>
          <div className="p-3 bg-muted/60 border border-border rounded-lg text-xs text-muted-foreground text-left">
            <span className="font-semibold text-foreground">Tip for System Administrators:</span>
            <p className="mt-1">
              Add your user ID (<code className="font-mono text-primary text-[11px]">{currentUser.id}</code>) to the{' '}
              <code className="font-mono text-[11px]">admin_users</code> table in Supabase.
            </p>
          </div>
          <button
            onClick={handleForceReset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-colors shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            Sign Out & Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!currentUser || !isAdmin) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
