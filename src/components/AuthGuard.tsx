import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function AuthGuard() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) checkAdmin(session.user.id);
      else setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) checkAdmin(session.user.id);
      else setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkAdmin = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        setIsAdmin(false);
        setAuthError("Access Denied: Database Error: " + (error?.message || 'Unknown'));
      } else if (!data) {
        setIsAdmin(false);
        setAuthError("Access Denied: Your account is logged in, but you are not listed in the admin_users table.");
      } else {
        setIsAdmin(true);
        setAuthError(''); // Clear any previous errors on successful validation
      }
    } catch (e: any) {
      setIsAdmin(false);
      setAuthError(e.message || "Failed to check admin status.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (authError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-red-50 text-red-800 border border-red-200 p-6 rounded-md max-w-md w-full shadow-sm text-center">
          <h2 className="text-2xl font-bold mb-2">Access Denied</h2>
          <p className="mb-4">{authError}</p>
          <p className="text-sm text-gray-600 mb-6">
            Make sure you have run the Supreme Admin Setup SQL snippet in your Supabase Dashboard to create the admin_users table and add your account!
          </p>
          <button 
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = '/login';
            }}
            className="text-primary hover:text-indigo-800 underline font-medium"
          >
            Sign Out & Return to Login
          </button>
        </div>
      </div>
    );
  }

  if (!session || !isAdmin) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
