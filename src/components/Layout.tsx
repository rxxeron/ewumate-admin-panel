import {
  LayoutDashboard, LogOut, Users, BellRing, BookOpen, Settings,
  Database, FileUp, Mail, CalendarDays, ShieldCheck, Globe,
  Menu, X, TrendingUp, Sun, Moon, Library, Clock, Heart,
  GraduationCap, ChevronDown, ChevronRight, Smartphone,
  PanelLeftClose, PanelLeft, Search, Activity
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation, Link, Outlet } from 'react-router-dom';
import { cn } from '../lib/utils';
import { CommandPalette } from './CommandPalette';

interface NavBadgeCounts {
  vault: number;
  hours: number;
  feedbacks: number;
  donations: number;
  proofs: number;
  reviews: number;
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('ewumate_admin_sidebar_collapsed') === 'true';
  });

  const toggleSidebarCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('ewumate_admin_sidebar_collapsed', String(next));
      return next;
    });
  };

  const isFacultyActive = ['/faculty', '/office-hours', '/faculty-assignments', '/faculty-reviews'].includes(location.pathname);
  const [isFacultyOpen, setIsFacultyOpen] = useState(isFacultyActive);

  useEffect(() => {
    if (isFacultyActive) {
      setIsFacultyOpen(true);
    }
  }, [location.pathname]);

  const [userProfile, setUserProfile] = useState<{ name: string; role: string; email?: string } | null>(null);
  const [edgeLatency, setEdgeLatency] = useState<number | null>(null);
  const [badges, setBadges] = useState<NavBadgeCounts>({
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

  const pingEdgeLatency = async () => {
    const start = performance.now();
    try {
      await supabase.from('profiles').select('id').limit(1).maybeSingle();
      const duration = Math.round(performance.now() - start);
      setEdgeLatency(duration);
    } catch {
      setEdgeLatency(null);
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
          .maybeSingle();

        const { data: admin } = await supabase
          .from('admin_users')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        setUserProfile({
          name: profile?.full_name || user.email?.split('@')[0] || 'Administrator',
          role: admin ? 'System Architect' : 'Staff Member',
          email: user.email,
        });
      }
    }

    fetchProfile();
    fetchBadges();
    pingEdgeLatency();

    const badgeInterval = setInterval(fetchBadges, 25000);
    const latencyInterval = setInterval(pingEdgeLatency, 45000);

    return () => {
      clearInterval(badgeInterval);
      clearInterval(latencyInterval);
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  // Derive human-readable breadcrumb trail
  const breadcrumbs = useMemo(() => {
    const path = location.pathname;
    if (path === '/') return ['Overview'];

    const segments = path.split('/').filter(Boolean);
    const namesMap: Record<string, string> = {
      analytics: 'Analytics',
      'active-semester': 'Active Semester',
      'calendar-editor': 'Academic Calendar',
      users: 'Student Directory',
      courses: 'Course Catalog',
      'academic-data': 'Master Data',
      scraper: 'Portal Scraper',
      'study-vault': 'Study Vault',
      'office-hours': 'Office Hours',
      'faculty-reviews': 'Student Reviews',
      'faculty-assignments': 'Faculty Proofs',
      tutorials: 'Tutorials',
      settings: 'App Settings',
      feedbacks: 'Feedback Inbox',
      donations: 'Developer Support',
      'data-quality': 'Data Integrity',
      faculty: 'Faculty Directory',
      notifications: 'Push Broadcaster',
      'local-notifications': 'Local Alarms & Logs',
      parser: 'File Sync'
    };

    return segments.map((seg, idx) => {
      if (namesMap[seg]) return namesMap[seg];
      if (segments[idx - 1] === 'users') return `Student: ${seg.slice(0, 8)}...`;
      return seg.replace(/-/g, ' ');
    });
  }, [location.pathname]);

  const totalPendingModerations = badges.vault + badges.hours + badges.proofs + badges.reviews + badges.feedbacks;

  const renderNavLink = (to: string, icon: any, label: string, badgeCount?: number) => {
    const Icon = icon;
    const isActive = location.pathname === to;

    return (
      <Link
        to={to}
        onClick={() => setIsMobileMenuOpen(false)}
        title={isCollapsed ? label : undefined}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg text-xs transition-colors duration-150 group relative',
          isActive
            ? 'bg-primary/10 text-primary font-semibold'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium'
        )}
      >
        <Icon className={cn('w-4 h-4 shrink-0 transition-transform group-hover:scale-105', isActive ? 'text-primary' : '')} />
        {!isCollapsed && <span className="truncate">{label}</span>}

        {/* Pending Badge */}
        {!isCollapsed && typeof badgeCount === 'number' && badgeCount > 0 && (
          <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full animate-pulse">
            {badgeCount}
          </span>
        )}

        {isCollapsed && typeof badgeCount === 'number' && badgeCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500 ring-2 ring-card" />
        )}

        {isActive && (
          <motion.div
            layoutId="activeNavIndicator"
            className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-primary rounded-r-full"
          />
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-screen bg-background font-sans overflow-hidden relative">
      <CommandPalette />

      {/* Structured Modern Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 bg-card text-foreground border-r border-border flex flex-col shadow-sm transition-all duration-300 lg:relative lg:translate-x-0',
          isCollapsed ? 'w-18' : 'w-64',
          !isMobileMenuOpen && '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className={cn(
          'h-16 px-4 border-b border-border flex items-center shrink-0',
          isCollapsed ? 'justify-center' : 'justify-between'
        )}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-lg overflow-hidden shrink-0 border border-border shadow-sm">
              <img src="/logo.png" alt="EWUMate" className="w-full h-full object-cover" />
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <span className="font-bold text-sm tracking-tight text-foreground">
                  EWUMate <span className="text-primary font-mono text-xs">Admin</span>
                </span>
                <p className="text-[10px] text-muted-foreground font-mono">v2.5 Production</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={toggleSidebarCollapse}
              className="hidden lg:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Scrollable Navigation Sections */}
        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          {/* Section 1: Platform & Insights */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                Overview & Insights
              </p>
            )}
            {renderNavLink('/', LayoutDashboard, 'Dashboard Overview')}
            {renderNavLink('/analytics', TrendingUp, 'Analytics Studio')}
          </div>

          {/* Section 2: Academic Core */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                Academic Core
              </p>
            )}
            {renderNavLink('/active-semester', CalendarDays, 'Active Semester')}
            {renderNavLink('/courses', BookOpen, 'Course Catalog')}
            {renderNavLink('/calendar-editor', CalendarDays, 'Academic Calendar')}
            {renderNavLink('/academic-data', Database, 'Global Master Data')}

            {/* Faculty Hub Group */}
            <div>
              <button
                onClick={() => setIsFacultyOpen(!isFacultyOpen)}
                className={cn(
                  'w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition-colors duration-150 group',
                  isFacultyActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60 font-medium'
                )}
                title={isCollapsed ? 'Faculty Hub' : undefined}
              >
                <div className="flex items-center gap-3">
                  <GraduationCap className={cn('w-4 h-4 shrink-0', isFacultyActive ? 'text-primary' : '')} />
                  {!isCollapsed && <span>Faculty Hub</span>}
                </div>
                {!isCollapsed && (
                  <div className="flex items-center gap-1.5">
                    {(badges.hours + badges.proofs + badges.reviews) > 0 && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-500/20 text-amber-500 rounded-full animate-pulse">
                        {badges.hours + badges.proofs + badges.reviews}
                      </span>
                    )}
                    <ChevronDown className={cn('w-3.5 h-3.5 transition-transform duration-200', isFacultyOpen ? 'rotate-180' : '')} />
                  </div>
                )}
              </button>

              <AnimatePresence initial={false}>
                {(isFacultyOpen || isCollapsed) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className={cn('space-y-1 my-1', isCollapsed ? '' : 'pl-4 border-l border-border ml-3')}
                  >
                    {renderNavLink('/faculty', Users, 'Directory')}
                    {renderNavLink('/office-hours', Clock, 'Office Hours', badges.hours)}
                    {renderNavLink('/faculty-assignments', ShieldCheck, 'Proofs Moderation', badges.proofs)}
                    {renderNavLink('/faculty-reviews', GraduationCap, 'Student Reviews', badges.reviews)}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Section 3: Student Community & Moderation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                Community & Moderation
              </p>
            )}
            {renderNavLink('/users', Users, 'Student Directory')}
            {renderNavLink('/study-vault', Library, 'Vault Moderation', badges.vault)}
            {renderNavLink('/feedbacks', Mail, 'Feedback Inbox', badges.feedbacks)}
            {renderNavLink('/tutorials', BookOpen, 'Tutorials')}
            {renderNavLink('/donations', Heart, 'Developer Support', badges.donations)}
          </div>

          {/* Section 4: DevOps & Automation */}
          <div className="space-y-1">
            {!isCollapsed && (
              <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-1">
                Automation & DevOps
              </p>
            )}
            {renderNavLink('/scraper', Globe, 'Portal Scraper')}
            {renderNavLink('/notifications', BellRing, 'Push Broadcaster')}
            {renderNavLink('/local-notifications', Smartphone, 'Local Alarms & Logs')}
            {renderNavLink('/parser', FileUp, 'File Sync')}
            {renderNavLink('/data-quality', ShieldCheck, 'Data Integrity')}
            {renderNavLink('/settings', Settings, 'App Config')}
          </div>
        </nav>

        {/* Sidebar Footer with Collapsed Toggle & Logout */}
        <div className="p-3 border-t border-border shrink-0 bg-card space-y-2">
          {isCollapsed && (
            <button
              onClick={toggleSidebarCollapse}
              className="w-full flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
              title="Expand sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handleLogout}
            className={cn(
              'flex items-center gap-2 w-full p-2 rounded-lg text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors',
              isCollapsed ? 'justify-center' : 'px-3'
            )}
            title="Sign out of Admin Panel"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Main Administrative Workspace */}
      <main className="flex-1 overflow-auto relative custom-scrollbar flex flex-col min-w-0">
        {/* High-Utility Modern Header */}
        <header className="h-16 bg-card/85 backdrop-blur-md sticky top-0 z-40 border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0">
          {/* Left: Mobile Toggle & Breadcrumbs */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden p-2 text-muted-foreground hover:bg-muted rounded-lg transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground truncate">
              <span className="font-semibold text-foreground">EWUMate</span>
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1.5">
                  <ChevronRight className="w-3 h-3 text-muted-foreground/60" />
                  <span className={cn(idx === breadcrumbs.length - 1 ? 'text-foreground font-semibold' : '')}>
                    {crumb}
                  </span>
                </span>
              ))}
            </div>
          </div>

          {/* Center: Command Palette Trigger */}
          <div className="flex-1 max-w-md mx-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-command-palette'))}
              className="w-full h-9 px-3 bg-muted/60 hover:bg-muted border border-border/80 rounded-lg text-xs text-muted-foreground flex items-center justify-between transition-colors shadow-sm"
            >
              <span className="flex items-center gap-2 truncate">
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">Search commands, pages, or students...</span>
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] bg-background border border-border rounded font-mono shrink-0">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right: Edge Latency, Theme Toggle, User Badge */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Live DB Ping Indicator */}
            {typeof edgeLatency === 'number' && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 bg-muted/50 border border-border rounded-full text-[11px] font-mono text-muted-foreground"
                title={`Database connection latency: ${edgeLatency}ms`}
              >
                <div className={cn(
                  'w-1.5 h-1.5 rounded-full animate-pulse',
                  edgeLatency < 300 ? 'bg-emerald-500' : edgeLatency < 800 ? 'bg-amber-500' : 'bg-rose-500'
                )} />
                <span>{edgeLatency}ms</span>
              </div>
            )}

            {/* Moderation Alerts Pill */}
            {totalPendingModerations > 0 && (
              <button
                onClick={() => navigate('/study-vault')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-xs font-semibold hover:bg-amber-500/20 transition-colors"
                title={`${totalPendingModerations} items requiring review`}
              >
                <Activity className="w-3.5 h-3.5 animate-pulse" />
                <span className="hidden sm:inline">Tasks</span>
                <span className="px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[10px] font-bold">
                  {totalPendingModerations}
                </span>
              </button>
            )}

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors border border-border"
              title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* User Profile Pill */}
            <div className="flex items-center gap-2 pl-1">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-white font-semibold text-xs shadow-sm">
                {userProfile?.name?.charAt(0).toUpperCase() || 'A'}
              </div>
              <div className="hidden lg:flex flex-col text-left">
                <span className="text-xs font-semibold text-foreground leading-tight">{userProfile?.name || 'Admin'}</span>
                <span className="text-[10px] font-mono text-primary font-bold">{userProfile?.role || 'Staff'}</span>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className="p-4 sm:p-6 lg:p-8 w-full max-w-screen-2xl mx-auto flex-1">
          <Outlet />
        </div>
      </main>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
