import { LayoutDashboard, LogOut, Users, BellRing, BookOpen, Settings, Database, FileUp, Mail, CalendarDays, ShieldCheck, Globe, Menu, X, TrendingUp, Sun, Moon, Library, Clock, PlayCircle, Heart, GraduationCap, ChevronDown, Smartphone } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';
import { CommandPalette } from './CommandPalette';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const isFacultyActive = ['/faculty', '/office-hours', '/faculty-assignments', '/faculty-reviews'].includes(location.pathname);
  const [isFacultyOpen, setIsFacultyOpen] = useState(isFacultyActive);

  useEffect(() => {
    if (isFacultyActive) {
      setIsFacultyOpen(true);
    }
  }, [location.pathname]);

  const [userProfile, setUserProfile] = useState<{ name: string; role: string } | null>(null);
  const [badges, setBadges] = useState<{ vault: number; hours: number; feedbacks: number; donations: number; proofs: number; reviews: number }>({
    vault: 0,
    hours: 0,
    feedbacks: 0,
    donations: 0,
    proofs: 0,
    reviews: 0,
  });

  const fetchBadges = async () => {
    try {
      const [vaultRes, hoursRes, feedbacksRes, donationsRes, proofsRes, reviewsRes] = await Promise.all([
        supabase.from('study_materials').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('faculty_office_hours').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('feedbacks').select('id', { count: 'exact', head: true }).in('status', ['open', 'pending']),
        supabase.from('donations').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('faculty_assignment_submissions').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
        supabase.from('faculty_reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      ]);

      setBadges({
        vault: vaultRes.count ?? 0,
        hours: hoursRes.count ?? 0,
        feedbacks: feedbacksRes.count ?? 0,
        donations: donationsRes.count ?? 0,
        proofs: proofsRes.count ?? 0,
        reviews: reviewsRes.count ?? 0,
      });
    } catch (e) {
      console.error('Error fetching sidebar badges:', e);
    }
  };

  useEffect(() => {
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single();
        
        // Check if admin
        const { data: admin } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        setUserProfile({
          name: profile?.full_name || user.email?.split('@')[0] || 'Administrator',
          role: admin ? 'System Architect' : 'Staff Member'
        });
      }
    }
    fetchProfile();
    fetchBadges();

    const interval = setInterval(fetchBadges, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return cn(
      "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all duration-200 group relative text-sm",
      isActive 
      ? 'bg-primary/10 text-primary font-semibold shadow-sm border border-primary/20' 
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium'
    );
  };

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden relative transition-colors duration-300">
      <CommandPalette />
      {/* Glassmorphic Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-72 bg-card text-foreground border-r border-border flex flex-col shadow-sm transition-transform duration-300 lg:relative lg:translate-x-0",
        !isMobileMenuOpen && "-translate-x-full"
      )}>
        <div className="p-8 font-semibold text-2xl border-b border-border flex items-center justify-center gap-3 mb-4">
          <motion.div 
            initial={{ rotate: -10, scale: 0.9 }}
            animate={{ rotate: 0, scale: 1 }}
            className="w-10 h-10 rounded-lg overflow-hidden shadow-lg shadow-sm/30 ring-1 ring-white/20 flex items-center justify-center shrink-0"
          >
            <img src="/logo.png" alt="EWUMate" className="w-full h-full object-cover" />
          </motion.div>
          <span className="tracking-tight">EWUmate <span className="text-primary">Admin</span></span>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar py-4">
          <Link to="/" className={getLinkClass('/')} onClick={() => setIsMobileMenuOpen(false)}>
            <LayoutDashboard className="w-5 h-5" />
            <span>Overview</span>
            {location.pathname === '/' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/analytics" className={getLinkClass('/analytics')} onClick={() => setIsMobileMenuOpen(false)}>
            <TrendingUp className="w-5 h-5" />
            <span>Advanced Analytics</span>
            {location.pathname === '/analytics' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <div className="pt-6 pb-2 px-4">
            <p className="text-xs font-semibold text-primary/50  ">Core Database</p>
          </div>
          
          <Link to="/academic-data" className={getLinkClass('/academic-data')} onClick={() => setIsMobileMenuOpen(false)}>
            <Database className="w-5 h-5" />
            <span>Global Data</span>
            {location.pathname === '/academic-data' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/active-semester" className={getLinkClass('/active-semester')} onClick={() => setIsMobileMenuOpen(false)}>
            <CalendarDays className="w-5 h-5" />
            <span>Active Semester</span>
            {location.pathname === '/active-semester' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/calendar-editor" className={getLinkClass('/calendar-editor')} onClick={() => setIsMobileMenuOpen(false)}>
            <CalendarDays className="w-5 h-5" />
            <span>Academic Calendar</span>
            {location.pathname === '/calendar-editor' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/users" className={getLinkClass('/users')} onClick={() => setIsMobileMenuOpen(false)}>
            <Users className="w-5 h-5" />
            <span>Students & Profiles</span>
            {location.pathname === '/users' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/courses" className={getLinkClass('/courses')} onClick={() => setIsMobileMenuOpen(false)}>
            <BookOpen className="w-5 h-5" />
            <span>Course Catalog</span>
            {location.pathname === '/courses' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          {/* Consolidated Faculty Hub */}
          <div className="space-y-1">
            <button
              onClick={() => setIsFacultyOpen(!isFacultyOpen)}
              className={cn(
                "w-full flex items-center justify-between px-4 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium",
                isFacultyActive
                  ? "bg-primary/10 text-primary font-semibold border border-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <div className="flex items-center gap-3">
                <GraduationCap className="w-5 h-5 text-primary" />
                <span>Faculty Hub</span>
              </div>
              <div className="flex items-center gap-1.5">
                {!isFacultyOpen && (badges.hours + badges.proofs + badges.reviews) > 0 && (
                  <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-full animate-pulse">
                    {badges.hours + badges.proofs + badges.reviews}
                  </span>
                )}
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", isFacultyOpen ? "rotate-180" : "")} />
              </div>
            </button>

            <AnimatePresence initial={false}>
              {isFacultyOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden pl-3 pr-1 space-y-1 border-l-2 border-primary/20 ml-4 my-1"
                >
                  <Link
                    to="/faculty"
                    className={getLinkClass('/faculty')}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Users className="w-4 h-4" />
                    <span>Faculty Directory</span>
                  </Link>

                  <Link
                    to="/office-hours"
                    className={getLinkClass('/office-hours')}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Clock className="w-4 h-4" />
                    <span>Office Hours</span>
                    {badges.hours > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-500 border border-sky-500/30 rounded-full animate-pulse">
                        {badges.hours}
                      </span>
                    )}
                  </Link>

                  <Link
                    to="/faculty-assignments"
                    className={getLinkClass('/faculty-assignments')}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>Faculty Proofs</span>
                    {badges.proofs > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-full animate-pulse">
                        {badges.proofs}
                      </span>
                    )}
                  </Link>

                  <Link
                    to="/faculty-reviews"
                    className={getLinkClass('/faculty-reviews')}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <GraduationCap className="w-4 h-4 text-primary" />
                    <span>Student Reviews</span>
                    {badges.reviews > 0 && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-full animate-pulse">
                        {badges.reviews}
                      </span>
                    )}
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link to="/data-quality" className={getLinkClass('/data-quality')} onClick={() => setIsMobileMenuOpen(false)}>
            <ShieldCheck className="w-5 h-5" />
            <span>Data Integrity</span>
            {location.pathname === '/data-quality' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <div className="pt-6 pb-2 px-4">
            <p className="text-xs font-semibold text-primary/50  ">Automations</p>
          </div>
          
          <Link to="/scraper" className={getLinkClass('/scraper')} onClick={() => setIsMobileMenuOpen(false)}>
            <Globe className="w-5 h-5" />
            <span>Portal Scraper</span>
            {location.pathname === '/scraper' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/notifications" className={getLinkClass('/notifications')} onClick={() => setIsMobileMenuOpen(false)}>
            <BellRing className="w-5 h-5" />
            <span>Push Broadcaster</span>
            {location.pathname === '/notifications' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/local-notifications" className={getLinkClass('/local-notifications')} onClick={() => setIsMobileMenuOpen(false)}>
            <Smartphone className="w-5 h-5 text-emerald-500" />
            <span>Local Alarms & Logs</span>
            {location.pathname === '/local-notifications' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <div className="pt-6 pb-2 px-4">
            <p className="text-xs font-semibold text-primary/50  ">Management</p>
          </div>

          <Link to="/study-vault" className={getLinkClass('/study-vault')} onClick={() => setIsMobileMenuOpen(false)}>
            <Library className="w-5 h-5" />
            <span>Vault Moderation</span>
            {badges.vault > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-primary/20 text-primary border border-primary/30 rounded-full animate-pulse">
                {badges.vault}
              </span>
            )}
            {location.pathname === '/study-vault' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/tutorials" className={getLinkClass('/tutorials')} onClick={() => setIsMobileMenuOpen(false)}>
            <PlayCircle className="w-5 h-5" />
            <span>Tutorials</span>
            {location.pathname === '/tutorials' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/feedbacks" className={getLinkClass('/feedbacks')} onClick={() => setIsMobileMenuOpen(false)}>
            <Mail className="w-5 h-5" />
            <span>Feedback Inbox</span>
            {badges.feedbacks > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30 rounded-full animate-pulse">
                {badges.feedbacks}
              </span>
            )}
            {location.pathname === '/feedbacks' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/donations" className={getLinkClass('/donations')} onClick={() => setIsMobileMenuOpen(false)}>
            <Heart className="w-5 h-5 text-primary" />
            <span>Developer Support</span>
            {badges.donations > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-rose-500/20 text-rose-500 border border-rose-500/30 rounded-full animate-pulse">
                {badges.donations}
              </span>
            )}
            {location.pathname === '/donations' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/parser" className={getLinkClass('/parser')} onClick={() => setIsMobileMenuOpen(false)}>
            <FileUp className="w-5 h-5" />
            <span>File Sync</span>
            {location.pathname === '/parser' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>

          <Link to="/settings" className={getLinkClass('/settings')} onClick={() => setIsMobileMenuOpen(false)}>
            <Settings className="w-5 h-5" />
            <span>App Config</span>
            {location.pathname === '/settings' && (
              <motion.div layoutId="activeNav" className="absolute left-0 w-1 h-6 bg-primary rounded-r-full" />
            )}
          </Link>
        </nav>

        <div className="p-4 border-t border-border mt-auto bg-card">
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center gap-3 w-full p-3 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold text-xs hover:bg-rose-600 hover:text-white transition-all border border-rose-500/20 group"
          >
            <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Logout
          </button>
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto relative custom-scrollbar flex flex-col">
        {/* Header with Glassmorphism */}
        <header className="bg-card/80 backdrop-blur-md sticky top-0 z-40 border-b border-border px-4 sm:px-8 py-3.5 flex items-center justify-between transition-colors duration-300">
          <div className="flex items-center gap-4">
            <button 
              className="lg:hidden p-2 text-muted-foreground hover:bg-slate-100 dark:hover:bg-accent hover:text-accent-foreground rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
            <div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">Admin Console</h1>
              <p className="text-xs text-muted-foreground dark:text-slate-500   mt-0.5">Management Terminal</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
             {/* Theme Toggle */}
             <button
               onClick={toggleTheme}
               className="p-3 bg-muted text-muted-foreground rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 transition-all shadow-sm border border-border dark:border-border group"
               title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
             >
               {theme === 'light' ? (
                 <Moon className="w-5 h-5 group-hover:rotate-12 transition-transform" />
               ) : (
                 <Sun className="w-5 h-5 group-hover:rotate-90 transition-transform" />
               )}
             </button>

             <div className="hidden sm:flex flex-col items-end mr-2">
               <span className="text-xs font-semibold text-foreground">{userProfile?.name || 'Loading...'}</span>
               <span className="text-xs font-bold text-primary ">{userProfile?.role || 'Staff'}</span>
             </div>
             <div className="w-10 h-10 rounded-lg bg-primary/10 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                <div className="w-full h-full bg-gradient-to-br from-indigo-500 to-blue-400 opacity-80 flex items-center justify-center text-foreground font-semibold">
                  {userProfile?.name?.charAt(0) || 'A'}
                </div>
             </div>
          </div>
        </header>

        {/* Content Wrapper with Animations */}
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-screen-2xl mx-auto flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}




