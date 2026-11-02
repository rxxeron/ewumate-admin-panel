import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { 
  Users, BookOpen, Activity, GraduationCap, Clock, 
  CalendarClock, Mail, Search, Zap, ShieldCheck, 
  TrendingUp, ArrowUpRight, RefreshCcw
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { motion } from 'framer-motion';
import type { Profile, DashboardStats, SemesterTrackStats } from '../types';
import { useTheme } from '../components/ThemeContext';
import { CardSkeleton, Skeleton } from '../components/Skeleton';
import { StatsGrid } from '../components/dashboard/StatsGrid';
import { SystemDiagnostics } from '../components/dashboard/SystemDiagnostics';
import { cn } from '../lib/utils';

export function Dashboard() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const [stats, setStats] = useState<DashboardStats>({
    users: 0,
    activeUsers24h: 0,
    programs: 0,
    courses: 0,
    notifications: 0,
    pendingFeedbacks: 0,
    inProgressFeedbacks: 0,
    resolvedFeedbacks: 0,
    ignoredFeedbacks: 0,
  });
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  const [activeUsers, setActiveUsers] = useState<Profile[]>([]);
  const [semesterStats, setSemesterStats] = useState<Record<string, SemesterTrackStats>>({});
  const [registrationTrend, setRegistrationTrend] = useState<any[]>([]);
  const [activityTrend, setActivityTrend] = useState<any[]>([]);
  const [vaultStats, setVaultStats] = useState({
    pending: 0,
    removalRequested: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

  

  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
      if (error) throw error;

      if (data) {
        setStats({
          users: data.stats.users || 0,
          activeUsers24h: data.stats.activeUsers24h || 0,
          programs: data.stats.programs || 0,
          courses: data.stats.courses || 0,
          notifications: data.stats.notifications || 0,
          pendingFeedbacks: data.stats.pendingFeedbacks || 0,
          inProgressFeedbacks: data.stats.inProgressFeedbacks || 0,
          resolvedFeedbacks: data.stats.resolvedFeedbacks || 0,
          ignoredFeedbacks: data.stats.ignoredFeedbacks || 0,
        });

        setVaultStats({
          pending: data.vaultStats.pending || 0,
          removalRequested: data.vaultStats.removalRequested || 0,
          approved: data.vaultStats.approved || 0,
          rejected: data.vaultStats.rejected || 0,
          total: data.vaultStats.total || 0
        });

        setRecentUsers((data.recentUsers as Profile[]) || []);
        setActiveUsers((data.activeUsers as Profile[]) || []);
        setSemesterStats(data.semesterStats || {});
        setRegistrationTrend(data.registrationTrend || []);
        setActivityTrend(data.activityTrend || []);
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      toast.error('Failed to load real-time dashboard analytics');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const toggleTrackState = async (track: string, field: 'is_advising_open' | 'is_next_semester_open', currentValue: boolean) => {
    const newValue = !currentValue;
    
    // Optimistic state update
    setSemesterStats(prev => {
      if (!prev[track]) return prev;
      return {
        ...prev,
        [track]: {
          ...prev[track],
          [field]: newValue
        }
      };
    });

    const { error } = await supabase
      .from('active_semester')
      .update({ [field]: newValue })
      .eq('track', track);

    if (error) {
      toast.error(`Failed to update ${track}: ${error.message}`);
      fetchDashboardData(true);
    } else {
      toast.success(`${track.replace('_', ' ')} ${field === 'is_advising_open' ? 'Advising' : 'Next Semester'} set to ${newValue ? 'ON' : 'OFF'}`);
    }
  };

  // Handle Search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.trim().length < 2) {
        setSearchResults([]);
        return;
      }


      try {
        const { data } = await supabase
          .from('profiles')
          .select('id, full_name, student_id, program_code')
          .or(`full_name.ilike.%${searchTerm}%,student_id.ilike.%${searchTerm}%`)
          .limit(5);
        
        setSearchResults((data as Profile[]) || []);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {

      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <Skeleton className="w-64 h-10" />
          <Skeleton className="w-48 h-10 rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
           <Skeleton className="lg:col-span-2 h-[400px] rounded-3xl" />
           <Skeleton className="h-[400px] rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
        <div>
          <h2 className="text-2xl sm:text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            Platform Insights
            {isRefreshing && <RefreshCcw className="w-5 h-5 text-primary animate-spin" />}
          </h2>
          <p className="text-muted-foreground font-bold text-xs   mt-1">Live Statistics & Global Overview</p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              className="w-full pl-11 pr-4 py-3 bg-card border border-slate-200 dark:border-border rounded-lg text-sm font-bold text-foreground focus:ring-2 focus:ring-ring dark:focus:ring-ring outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 shadow-sm"
              placeholder="Search students..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute z-50 mt-2 w-full bg-card rounded-lg shadow-sm border border-border overflow-hidden"
              >
                {searchResults.map((user) => (
                  <button
                    key={user.id}
                    className="w-full text-left p-4 hover:bg-accent hover:text-accent-foreground border-b border-border last:border-0 transition-colors"
                    onClick={() => navigate(`/users/${user.id}`)}
                  >
                    <div className="font-semibold text-foreground">{user.full_name}</div>
                    <div className="text-xs text-primary font-semibold  ">{user.student_id} • {user.program_code}</div>
                  </button>
                ))}
              </motion.div>
            )}
          </div>
          <button 
            onClick={() => fetchDashboardData(true)}
            className="p-3 bg-card border border-slate-200 dark:border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all shadow-sm"
          >
            <RefreshCcw className={cn("w-5 h-5", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>
      
      {/* Top Stats Grid */}
      <StatsGrid stats={stats} />

      {/* Main Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Registration Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg sm:rounded-lg p-4 sm:p-8 shadow-sm border border-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-lg">
                <TrendingUp className="w-5 h-5 text-primary dark:text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">Growth Trend</h3>
                <p className="text-xs text-muted-foreground dark:text-slate-500  ">New users per day (Last 14 days)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-xs font-semibold ">
              <ArrowUpRight className="w-3 h-3" />
              Rising
            </div>
          </div>
          
          <div className="flex-1 h-[280px] w-full">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={registrationTrend}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="count" 
                  stroke="#6366f1" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorTotal)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Activity Trend Chart */}
        <div className="lg:col-span-2 bg-card rounded-lg sm:rounded-lg p-4 sm:p-8 shadow-sm border border-border flex flex-col overflow-hidden">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-lg">
                <Activity className="w-5 h-5 text-primary dark:text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground tracking-tight">Activity Heatmap</h3>
                <p className="text-xs text-muted-foreground dark:text-slate-500  ">Active users per day (Last 7 days)</p>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-xs font-semibold ">
              7D Window
            </div>
          </div>
          
          <div className="flex-1 h-[280px] w-full">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={activityTrend}>
                <defs>
                  <linearGradient id="colorActive" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
                <XAxis 
                  dataKey="date" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="active" 
                  stroke="#10b981" 
                  strokeWidth={4} 
                  fillOpacity={1} 
                  fill="url(#colorActive)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* System Health / Status */}
        <div className="lg:col-span-4 grid grid-cols-1 md:grid-cols-4 gap-8">
           <div className="md:col-span-3 bg-card rounded-lg sm:rounded-lg p-6 sm:p-8 shadow-sm border border-border flex flex-col">
              <SystemDiagnostics />

              {/* Feedback Breakdown */}
              <div className="mt-8 pt-8 border-t border-border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight  ">Feedback Resolution</h3>
                  <button onClick={() => navigate('/feedbacks')} className="text-xs font-semibold text-primary hover:underline">Manage Feedbacks</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Pending', count: stats.pendingFeedbacks, color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'In Progress', count: stats.inProgressFeedbacks, color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Resolved', count: stats.resolvedFeedbacks, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Ignored', count: stats.ignoredFeedbacks, color: 'text-muted-foreground' }
                  ].map((stat, i) => (
                    <div key={i} className="p-3.5 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                      <p className={cn("text-xl font-bold", stat.color)}>{stat.count}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Study Vault Breakdown */}
              <div className="mt-8 pt-8 border-t border-border">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-sm font-semibold text-foreground tracking-tight">Vault Moderation</h3>
                  <button onClick={() => navigate('/study-vault')} className="text-xs font-semibold text-primary hover:underline">Manage Vault</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[
                    { label: 'Pending', count: vaultStats.pending, color: 'text-amber-600 dark:text-amber-400' },
                    { label: 'Removal Req.', count: vaultStats.removalRequested, color: 'text-rose-600 dark:text-rose-400' },
                    { label: 'Approved', count: vaultStats.approved, color: 'text-emerald-600 dark:text-emerald-400' },
                    { label: 'Rejected', count: vaultStats.rejected, color: 'text-muted-foreground' },
                    { label: 'Total Items', count: vaultStats.total, color: 'text-primary', isTotal: true }
                  ].map((stat, i) => (
                    <div key={i} className={cn("p-3.5 rounded-lg bg-muted/50 border border-border", stat.isTotal && "border-primary/30")}>
                      <p className="text-xs font-medium text-muted-foreground mb-1">{stat.label}</p>
                      <p className={cn("text-xl font-bold", stat.color)}>{stat.count}</p>
                    </div>
                  ))}
                </div>
              </div>

           </div>
            
            <div className="bg-card rounded-lg sm:rounded-lg p-6 sm:p-8 shadow-sm border border-border flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                    <Zap className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground tracking-tight  ">Quick Actions</h3>
                    <p className="text-xs text-muted-foreground dark:text-slate-500   mt-0.5">Control Shortcuts</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  {/* Feedback Action */}
                  <button 
                    className="w-full p-4 bg-muted/40 hover:bg-muted/80 rounded-xl text-foreground font-semibold text-xs border border-border hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-between group"
                    onClick={() => navigate('/feedbacks')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                        <Mail className="w-4 h-4" />
                      </div>
                      <span className="text-foreground font-semibold">Feedback Panel</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>

                  {/* Study Vault Action */}
                  <button 
                    className="w-full p-4 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs rounded-xl shadow-md hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-between group"
                    onClick={() => navigate('/study-vault')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-white/20 text-white">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <span className="text-white font-semibold">Study Vault</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>

                  {/* Scraper Action */}
                  <button 
                    className="w-full p-4 bg-muted/40 hover:bg-muted/80 rounded-xl text-foreground font-semibold text-xs border border-border hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-between group"
                    onClick={() => navigate('/scraper')}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary">
                        <Zap className="w-4 h-4" />
                      </div>
                      <span className="text-foreground font-semibold">Launch Scraper</span>
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                  </button>
                </div>
              </div>
              
              <div className="mt-8 p-4 bg-background/50 rounded-lg border border-border text-xs font-medium text-muted-foreground text-center leading-relaxed">
                EWUmate Administrative Shortcuts console. Select any action above to manage respective systems.
              </div>
            </div>
        </div>
      </div>

      {/* Semester Tracks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {Object.entries(semesterStats).map(([track, data]) => (
          <motion.div 
            key={track} 
            whileHover={{ y: -4 }}
            className="bg-card rounded-lg sm:rounded-lg shadow-sm border border-border overflow-hidden flex flex-col"
          >
            <div className="px-8 py-6 border-b border-border flex items-center justify-between bg-muted/50">
              <div className="flex items-center gap-3">
                <CalendarClock className="w-5 h-5 text-primary dark:text-primary" />
                <h3 className="text-lg font-semibold text-foreground capitalize tracking-tight">{track.replace('_', ' ')}</h3>
              </div>
              <div className="px-3 py-1 bg-card rounded-full border border-slate-200 dark:border-border text-xs font-semibold text-muted-foreground  ">Active Track</div>
            </div>
            
            <div className="grid grid-cols-2 divide-x divide-slate-50 dark:divide-white/5 flex-1">
              <div className="p-8 text-center">
                <p className="text-xs text-muted-foreground dark:text-slate-500   mb-2">Current</p>
                <h4 className="text-xl font-semibold text-primary dark:text-primary mb-4">{data.current || 'N/A'}</h4>
                <div className="flex justify-center gap-3">
                  <div className="px-3 py-2 bg-muted rounded-lg border border-border flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{data.current_courses}</span>
                    <span className="text-xs font-bold text-muted-foreground ">Courses</span>
                  </div>
                  <div className="px-3 py-2 bg-muted rounded-lg border border-border flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{data.current_sections}</span>
                    <span className="text-xs font-bold text-muted-foreground ">Sec</span>
                  </div>
                </div>
              </div>
              
              <div className="p-8 text-center bg-muted/10">
                <p className="text-xs text-muted-foreground dark:text-slate-500   mb-2">Upcoming</p>
                <h4 className="text-xl font-semibold text-primary dark:text-primary mb-4">{data.next || 'N/A'}</h4>
                <div className="flex justify-center gap-3">
                  <div className="px-3 py-2 bg-card rounded-lg border border-border flex flex-col shadow-sm">
                    <span className="text-sm font-semibold text-foreground">{data.next_courses}</span>
                    <span className="text-xs font-bold text-muted-foreground ">Courses</span>
                  </div>
                  <div className="px-3 py-2 bg-card rounded-lg border border-border flex flex-col shadow-sm">
                    <span className="text-sm font-semibold text-foreground">{data.next_sections}</span>
                    <span className="text-xs font-bold text-muted-foreground ">Sec</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Status Toggles */}
            <div className="p-6 bg-muted/30 border-t border-border grid grid-cols-2 gap-4">
              {/* Advising Toggle */}
              <div 
                onClick={() => toggleTrackState(track, 'is_advising_open', data.is_advising_open)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between group/toggle ${
                  data.is_advising_open 
                    ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20 shadow-sm' 
                    : 'bg-card border-border hover:border-slate-200 dark:hover:border-border'
                }`}
              >
                <div>
                  <p className={`text-xs font-semibold   mb-0.5 ${
                    data.is_advising_open ? 'text-primary dark:text-primary' : 'text-muted-foreground'
                  }`}>Advising System</p>
                  <p className="text-xs font-semibold text-foreground">
                    {data.is_advising_open ? 'OPEN' : 'CLOSED'}
                  </p>
                </div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${
                  data.is_advising_open ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                    data.is_advising_open ? 'left-5' : 'left-1'
                  }`} />
                </div>
              </div>

              {/* Next Semester Toggle */}
              <div 
                onClick={() => toggleTrackState(track, 'is_next_semester_open', data.is_next_semester_open)}
                className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between group/toggle ${
                  data.is_next_semester_open 
                    ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20 shadow-sm' 
                    : 'bg-card border-border hover:border-slate-200 dark:hover:border-border'
                }`}
              >
                <div>
                  <p className={`text-xs font-semibold   mb-0.5 ${
                    data.is_next_semester_open ? 'text-primary dark:text-primary' : 'text-muted-foreground'
                  }`}>Next Sem Screen</p>
                  <p className="text-xs font-semibold text-foreground">
                    {data.is_next_semester_open ? 'VISIBLE' : 'HIDDEN'}
                  </p>
                </div>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${
                  data.is_next_semester_open ? 'bg-primary' : 'bg-slate-200 dark:bg-slate-700'
                }`}>
                  <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                    data.is_next_semester_open ? 'left-5' : 'left-1'
                  }`} />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Tables Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Registrations */}
        <div className="bg-card rounded-lg sm:rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="px-6 sm:px-8 py-5 sm:py-6 border-b border-border flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold text-foreground flex items-center gap-3 tracking-tight">
              <div className="w-2 h-2 rounded-full bg-primary" />
              New Students
            </h3>
            <button className="text-xs font-semibold text-primary dark:text-primary   hover:underline" onClick={() => navigate('/users')}>View All</button>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[500px] sm:min-w-0">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-8 py-4 text-left text-xs text-muted-foreground dark:text-slate-500  ">Student Info</th>
                  <th className="px-8 py-4 text-left text-xs text-muted-foreground dark:text-slate-500  ">Join Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {recentUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors group" onClick={() => navigate(`/users/${user.id}`)}>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-semibold text-muted-foreground group-hover:bg-primary/10 dark:group-hover:bg-primary/10 group-hover:text-primary transition-all  text-xs">
                          {user.full_name?.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">{user.full_name || 'Unknown'}</div>
                          <div className="text-xs text-primary font-bold  ">{user.student_id || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-xs font-bold text-foreground">
                        {new Date(user.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <div className="text-xs text-muted-foreground font-bold">
                        {new Date(user.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
          <div className="px-8 py-6 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground flex items-center gap-3 tracking-tight">
              <div className="w-2 h-2 rounded-full bg-primary" />
              Recent Activity
            </h3>
            <button className="text-xs font-semibold text-primary dark:text-primary   hover:underline" onClick={() => navigate('/users')}>View Trends</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-8 py-4 text-left text-xs text-muted-foreground dark:text-slate-500  ">User</th>
                  <th className="px-8 py-4 text-center text-xs text-muted-foreground dark:text-slate-500  ">Sessions</th>
                  <th className="px-8 py-4 text-left text-xs text-muted-foreground dark:text-slate-500  ">Last Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {activeUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-accent hover:text-accent-foreground cursor-pointer transition-colors group" onClick={() => navigate(`/users/${user.id}`)}>
                    <td className="px-8 py-5">
                      <div className="text-sm font-semibold text-foreground truncate max-w-[150px]">{user.full_name || 'Unknown'}</div>
                      <div className="text-xs text-primary font-bold  ">{user.student_id || '-'}</div>
                    </td>
                    <td className="px-8 py-5 text-center">
                      <span className="px-3 py-1 bg-muted rounded-lg text-xs font-semibold text-foreground border border-border">
                        {user.app_open_count || 0}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className="text-xs font-bold text-foreground">
                        {user.last_active_at ? new Date(user.last_active_at).toLocaleDateString([], { month: 'short', day: 'numeric' }) : 'Never'}
                      </div>
                      <div className="text-xs text-muted-foreground font-bold">
                        {user.last_active_at ? new Date(user.last_active_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' }) : '-'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}


