import { useEffect, useState, useCallback } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Loader2, LogOut } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

export function AuthGuard() {
  const location = useLocation();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  const checkUserAdmin = useCallback(async (user: User): Promise<boolean> => {
    try {
      // Primary check: Execute secure server-side RPC is_admin()
      const { data: rpcAdmin, error: rpcError } = await supabase.rpc('is_admin');
      if (!rpcError && typeof rpcAdmin === 'boolean') {
        return rpcAdmin;
      }

      // Fallback check: Direct query to admin_users table under authenticated session
      const { data: adminRecord, error: tableError } = await supabase
        .from('admin_users')
        .select('id, user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      return !tableError && !!adminRecord;
    } catch {
      return false;
    }
  }, []);

  const initAuth = useCallback(async () => {
    try {
      // Retrieve the existing session stored in localStorage
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session || !session.user) {
        setCurrentUser(null);
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const user = session.user;
      setCurrentUser(user);

      // Verify admin authorization
      const hasAdminRights = await checkUserAdmin(user);

      if (hasAdminRights) {
        setIsAdmin(true);
        setAuthError('');
      } else {
        setIsAdmin(false);
        setAuthError(
          `Access Denied: Account '${user.email}' is authenticated, but is not authorized in the admin directory.`
        );
      }
    } catch (err: any) {
      setCurrentUser(null);
      setIsAdmin(false);
      setAuthError(err?.message || 'Authentication error occurred.');
    } finally {
      setLoading(false);
    }
  }, [checkUserAdmin]);

  useEffect(() => {
    // Initial session hydration
    initAuth();

    // Listen only to actual state change events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    // Do NOT trigger sign-out or cancel loading on INITIAL_SESSION
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setIsAdmin(false);
        setLoading(false);
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setCurrentUser(session.user);
          const hasAdmin = await checkUserAdmin(session.user);
          setIsAdmin(hasAdmin);
        }
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initAuth, checkUserAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
          Verifying security credentials...
        </p>
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
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
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
