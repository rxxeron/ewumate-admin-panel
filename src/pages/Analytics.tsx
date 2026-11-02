import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, Activity, 
  RefreshCcw, Users, 
  ArrowUpRight, Clock,
  GraduationCap,
  BarChart3
} from 'lucide-react';
import { 
  XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, ComposedChart, Area, Bar,
  AreaChart
} from 'recharts';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useTheme } from '../components/ThemeContext';

type TimeRange = '1W' | '14D' | '1M' | '3M' | '6M' | '1Y';

export function Analytics() {
  const { theme } = useTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('1M');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [growthData, setGrowthData] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    rollingMau: 0,
    rollingYau: 0,
    growthRate: 0,
    peakActivity: 0
  });

  const [funnelData, setFunnelData] = useState({
    registered: 0,
    courseHistory: 0,
    completed: 0,
    total: 0
  });

  const timeWindows = {
    '1W': 7,
    '14D': 14,
    '1M': 30,
    '3M': 90,
    '6M': 180,
    '1Y': 365
  };

  const fetchAnalytics = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      else setIsRefreshing(true);

      const days = timeWindows[timeRange];
      
      const { data, error } = await supabase.rpc('get_admin_analytics_stats', { timeframe_days: days });
      if (error) throw error;

      if (data) {
        setFunnelData({
          registered: data.funnelData.registered || 0,
          courseHistory: data.funnelData.courseHistory || 0,
          completed: data.funnelData.completed || 0,
          total: data.funnelData.total || 0
        });
        
        setGrowthData(data.growthData || []);
        setActivityData(data.activityData || []);
        
        setStats({
          totalUsers: data.stats.totalUsers || 0,
          activeUsers: data.stats.activeUsers || 0,
          rollingMau: data.stats.rollingMau || 0,
          rollingYau: data.stats.rollingYau || 0,
          growthRate: parseFloat(data.stats.growthRate || '0'),
          peakActivity: data.stats.peakActivity || 0
        });
      }
    } catch (err) {
      console.error('Failed to fetch analytics:', err);
      toast.error('Failed to load system analytics trend');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  if (loading && !isRefreshing) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCcw className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            Advanced Analytics
            {isRefreshing && <RefreshCcw className="w-5 h-5 text-primary animate-spin" />}
          </h2>
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider mt-1">Ecosystem Activity & Conversion Insights</p>
        </div>

        <div className="flex items-center gap-2 bg-card p-1.5 rounded-lg border border-slate-200 dark:border-border shadow-sm">
          {(['1W', '14D', '1M', '3M', '6M', '1Y'] as TimeRange[]).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={cn(
                "px-4 py-2.5 rounded-xl text-xs font-semibold transition-all",
                timeRange === range 
                ? "bg-slate-900 dark:bg-primary text-white shadow-lg shadow-slate-200 dark:shadow-none" 
                : "text-muted-foreground hover:text-slate-900 dark:hover:text-white hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {range}
            </button>
          ))}
          <div className="w-px h-4 bg-slate-200 dark:bg-white/10 mx-1" />
          <button 
            onClick={() => fetchAnalytics(true)}
            className="p-2.5 text-muted-foreground hover:text-primary dark:hover:text-primary transition-colors"
          >
            <RefreshCcw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Top Insights Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Active Today (DAU)', value: stats.activeUsers, icon: Activity, sub: 'Daily active pulse', color: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/10' },
          { label: 'Active Month (MAU)', value: stats.rollingMau, icon: BarChart3, sub: '30-day rolling active', color: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/10' },
          { label: 'Active Year (YAU)', value: stats.rollingYau, icon: Clock, sub: '365-day rolling active', color: 'text-primary dark:text-primary', bg: 'bg-primary/10 dark:bg-primary/10' },
          { 
            label: 'Total Ecosystem', 
            value: stats.totalUsers, 
            icon: Users, 
            sub: 'Cumulative Profiles', 
            color: 'text-slate-600 dark:text-slate-300', 
            bg: 'bg-slate-100 dark:bg-slate-700/50',
            badge: stats.growthRate > 0 ? `+${stats.growthRate}%` : null
          }
        ].map((item, i) => (
          <motion.div 
            key={i}
            whileHover={{ y: -4 }}
            className="bg-card p-6 rounded-lg border border-border shadow-sm flex items-center gap-5 transition-all"
          >
            <div className={cn("p-4 rounded-lg shadow-inner", item.bg, item.color)}>
              <item.icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider truncate">{item.label}</p>
                {item.badge && (
                  <span className="text-[8px] font-semibold px-1.5 py-0.5 rounded-md bg-primary/10 text-primary dark:text-primary ml-1">
                    {item.badge}
                  </span>
                )}
              </div>
              <p className="text-2xl font-semibold text-foreground mt-0.5">{item.value}</p>
              <p className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5">{item.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Growth Trend Section */}
      <div className="bg-card rounded-[2.5rem] p-6 sm:p-10 border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-xl">
                <TrendingUp className="w-5 h-5 text-primary dark:text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground tracking-tight">Ecosystem Growth Engine</h3>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cumulative User Adoption Trend ({timeRange})</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Growth</p>
                <p className="text-lg font-semibold text-primary dark:text-primary">
                  +{growthData[growthData.length - 1]?.total - (growthData[0]?.total || 0)} Students
                </p>
             </div>
             <div className="w-px h-8 bg-muted" />
             <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-[10px] font-semibold uppercase">
                <ArrowUpRight className="w-4 h-4" />
                Expanding
             </div>
          </div>
        </div>

        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={growthData}>
              <defs>
                <linearGradient id="growthGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                dy={15}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
              />
              <Tooltip 
                contentStyle={{ 
                  borderRadius: '20px', 
                  border: 'none', 
                  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                  padding: '16px',
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                  color: theme === 'dark' ? '#ffffff' : '#0f172a',
                }}
                itemStyle={{ fontWeight: 'black', fontSize: '14px' }}
                labelStyle={{ fontWeight: 'bold', color: '#94a3b8', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
              />
              <Area 
                type="monotone" 
                dataKey="total" 
                name="Total Students"
                stroke="#6366f1" 
                strokeWidth={5} 
                fillOpacity={1} 
                fill="url(#growthGradient)" 
                animationDuration={1500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Activity Heatmap Chart Section */}
      <div className="bg-card rounded-[2.5rem] p-6 sm:p-10 border border-border shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-xl">
                <Activity className="w-5 h-5 text-primary dark:text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground tracking-tight">Active Pulse & Heatmap</h3>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Co-plotting Daily Active (DAU) & Monthly Active (MAU) ({timeRange})</p>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="text-right">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Avg Daily</p>
                <p className="text-lg font-semibold text-primary dark:text-primary">
                  {Math.round(activityData.reduce((acc, curr) => acc + curr.dau, 0) / (activityData.length || 1))} DAU
                </p>
             </div>
             <div className="w-px h-8 bg-muted" />
             <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-[10px] font-semibold uppercase">
                Active Pulse
             </div>
          </div>
        </div>

        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={activityData}>
              <defs>
                <linearGradient id="mauGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme === 'dark' ? '#334155' : '#f1f5f9'} />
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
                dy={15}
                minTickGap={30}
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fontWeight: 'bold', fill: '#94a3b8' }} 
              />
              <Tooltip 
                cursor={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.03)' : '#f8fafc', radius: 10 }}
                contentStyle={{ 
                  backgroundColor: theme === 'dark' ? '#1e293b' : '#ffffff',
                  borderRadius: '20px', 
                  border: 'none', 
                  boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)',
                  padding: '16px',
                  color: theme === 'dark' ? '#ffffff' : '#0f172a'
                }}
              />
              
              {/* Daily Active Users as Bar */}
              <Bar 
                dataKey="dau" 
                name="Daily Active (DAU)"
                fill="#10b981" 
                radius={[4, 4, 0, 0]} 
                barSize={timeRange === '1Y' ? 2 : timeRange === '6M' ? 4 : timeRange === '3M' ? 8 : 16}
              />

              {/* Monthly Active Users as Area Chart Overlay */}
              <Area 
                type="monotone" 
                dataKey="mau" 
                name="Monthly Active (MAU)"
                stroke="#6366f1" 
                strokeWidth={3} 
                fillOpacity={1}
                fill="url(#mauGradient)"
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Onboarding & Registration Funnel Section */}
      <div className="bg-card rounded-[2.5rem] p-6 sm:p-10 border border-border shadow-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-xl text-primary dark:text-primary">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-foreground tracking-tight">Onboarding & Registration Funnel</h3>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-0.5">Student Conversion & Funnel Efficiency</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Visual Funnel Representation */}
          <div className="lg:col-span-7 space-y-6">
            {[
              { 
                stage: 'Stage 1: Account Created', 
                count: funnelData.total, 
                percent: 100, 
                desc: 'Students who created their EWUmate credentials', 
                color: 'from-slate-500 to-slate-600 dark:from-slate-600 dark:to-slate-700',
                text: 'text-muted-foreground' 
              },
              { 
                stage: 'Stage 2: Academic Setup', 
                count: funnelData.courseHistory + funnelData.completed, 
                percent: funnelData.total > 0 ? Math.round(((funnelData.courseHistory + funnelData.completed) / funnelData.total) * 100) : 0, 
                desc: 'Entered course history or completed semester plan registration', 
                color: 'from-blue-500 to-indigo-600',
                text: 'text-blue-600 dark:text-blue-400' 
              },
              { 
                stage: 'Stage 3: Profile Completed', 
                count: funnelData.completed, 
                percent: funnelData.total > 0 ? Math.round((funnelData.completed / funnelData.total) * 100) : 0, 
                desc: 'Fully onboarded, active profile matching, and full portal access enabled', 
                color: 'from-emerald-500 to-teal-600',
                text: 'text-emerald-600 dark:text-emerald-400' 
              }
            ].map((step, idx) => (
              <div key={idx} className="relative group">
                <div className="flex justify-between items-end mb-2">
                  <div>
                    <h4 className="text-xs font-semibold text-foreground">{step.stage}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.desc}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-foreground">{step.count} <span className="text-xs font-medium text-muted-foreground">Students</span></span>
                    <span className={cn("text-xs font-semibold ml-3 px-2 py-0.5 rounded-md bg-muted", step.text)}>{step.percent}%</span>
                  </div>
                </div>
                
                {/* Visual Bar */}
                <div className="h-6 w-full bg-muted rounded-lg overflow-hidden border border-border relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${step.percent}%` }}
                    transition={{ duration: 1.2, ease: "easeOut", delay: idx * 0.2 }}
                    className={cn("h-full rounded-lg bg-gradient-to-r shadow-sm", step.color)}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Conversion Insights Sidebar */}
          <div className="lg:col-span-5 bg-card border border-border rounded-xl p-6 sm:p-8 flex flex-col justify-between h-full">
            <div>
              <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                Funnel Performance Insights
              </h4>
              <div className="space-y-4">
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Overall Conversion</span>
                  <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {funnelData.total > 0 ? ((funnelData.completed / funnelData.total) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Drop-off / Churn Rate</span>
                  <span className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                    {funnelData.total > 0 ? (((funnelData.total - funnelData.completed) / funnelData.total) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
                <div className="flex justify-between items-center py-3 border-b border-border">
                  <span className="text-xs font-medium text-muted-foreground">Setup Drop-off</span>
                  <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    {funnelData.total > 0 ? (((funnelData.total - (funnelData.courseHistory + funnelData.completed)) / funnelData.total) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-8 p-4 bg-muted/60 rounded-lg border border-border text-xs text-muted-foreground leading-relaxed">
              <span className="font-semibold text-primary uppercase tracking-wider block mb-1">PRO-TIP</span>
              Users who drop off at Stage 2 (Academic Setup) typically lack their EWU portals login info handy during sign up. Sending a nudge push notification with a portal helper link can improve activation rates by up to 18%.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
