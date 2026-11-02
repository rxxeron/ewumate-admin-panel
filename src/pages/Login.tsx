import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function Login() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate('/');
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    } else {
      navigate('/');
    }

    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      }
    });
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900 via-slate-950 to-black flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[128px] pointer-events-none"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center flex-col items-center">
          <div className="w-20 h-20 rounded-lg overflow-hidden shadow-xl shadow-sm/50 mb-4 ring-2 ring-white/10 transform -rotate-3 transition-transform hover:rotate-0 duration-300">
            <img src="/logo.png" alt="EWUMate Logo" className="w-full h-full object-cover" />
          </div>
          <h2 className="text-center text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400 drop-shadow-sm">
            EWUMate Admin
          </h2>
          <p className="mt-2 text-center text-sm text-indigo-200 font-medium tracking-wider uppercase">
            Secure Mission Control
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10 transition-all duration-500 hover:scale-[1.01]">
        <div className="bg-slate-900/60 backdrop-blur-xl py-8 px-4 shadow-[0_0_40px_-15px_rgba(79,70,229,0.5)] border border-slate-700/50 sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-semibold text-indigo-300 mb-1 tracking-wide">Email Command</label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="commander@ewumate.com"
                className="block w-full border-0 bg-slate-950/80 rounded-xl shadow-inner text-indigo-100 placeholder-slate-600 ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-ring p-3 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-indigo-300 mb-1 tracking-wide">Access Cipher</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full border-0 bg-slate-950/80 rounded-xl shadow-inner text-indigo-100 placeholder-slate-600 ring-1 ring-inset ring-slate-800 focus:ring-2 focus:ring-inset focus:ring-ring p-3 outline-none transition-all"
              />
            </div>

            {error && (
              <div className="bg-red-950/50 border border-red-500/50 rounded-lg p-3 text-red-200 text-sm flex items-center gap-2 animate-pulse">
                <Shield className="w-5 h-5 text-red-400 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-[0_0_15px_-3px_rgba(79,70,229,0.6)] text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring focus:ring-offset-slate-900 transition-all uppercase tracking-wider disabled:opacity-50"
            >
              {loading ? 'Authenticating...' : 'Initialize Override'}
            </button>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-700/80" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-background/80 px-4 rounded-full text-primary/80 text-xs font-semibold tracking-wider uppercase">Or execute via</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full flex justify-center items-center gap-3 py-3 px-4 border border-slate-700 rounded-xl shadow-sm text-sm font-bold text-slate-200 bg-slate-950/50 hover:bg-slate-800 hover:border-slate-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 focus:ring-offset-slate-900 transition-all disabled:opacity-50 tracking-wider"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google Identity
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

