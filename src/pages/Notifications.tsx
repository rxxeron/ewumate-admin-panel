import { useState, useEffect } from 'react';
import { supabaseAdmin as supabase } from '../lib/supabase';
import { cn } from '../lib/utils';
import { 
  RefreshCw, Send, Link as LinkIcon, Clock, Building, Target, BookmarkPlus, 
  History, Copy, BellRing, Users, ShieldCheck, Package, Smartphone, Activity, 
  CheckCircle2, Radio, Server, ChevronDown, ChevronUp, Search, XCircle, ListFilter 
} from 'lucide-react'; 
import toast from 'react-hot-toast';
import type { NotificationTemplate, LocalNotificationState, LocalNotificationLog } from '../types';

const TEMPLATES_KEY = 'ewumate_notification_templates';

function loadTemplates(): NotificationTemplate[] {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveTemplates(templates: NotificationTemplate[]) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates));
}

import { useLocation } from 'react-router-dom';

export function Notifications({ defaultView }: { defaultView?: 'composer' | 'local_stats' | 'system_health' }) {
  const location = useLocation();
  const initialView = defaultView || (location.pathname.includes('local-notifications') ? 'local_stats' : 'composer');
  const [mainView, setMainView] = useState<'composer' | 'local_stats' | 'system_health'>(initialView);

  useEffect(() => {
    if (location.pathname.includes('local-notifications')) {
      setMainView('local_stats');
    }
  }, [location.pathname]);
  const [activeTab, setActiveTab] = useState<'global' | 'department' | 'user' | 'status' | 'version'>('global');
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [url, setUrl] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('');
  const [targetStatus, setTargetStatus] = useState('');
  const [targetVersion, setTargetVersion] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [departments, setDepartments] = useState<string[]>([]);
  const [availableVersions, setAvailableVersions] = useState<string[]>([]);
  const [statuses] = useState<string[]>(['registered', 'course_history', 'completed']);

  const [loading, setLoading] = useState(false);

  // Templates & History state
  const [templates, setTemplates] = useState<NotificationTemplate[]>(loadTemplates());
  const [templateName, setTemplateName] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Local Notification States & Telemetry
  const [localStates, setLocalStates] = useState<LocalNotificationState[]>([]);
  const [localStatesLoading, setLocalStatesLoading] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const [expandedDevice, setExpandedDevice] = useState<string | null>(null);

  // Individual Local Notification Logs (Scheduled / Delivered / Failed)
  const [localLogs, setLocalLogs] = useState<LocalNotificationLog[]>([]);
  const [localLogsLoading, setLocalLogsLoading] = useState(false);
  const [localLogFilter, setLocalLogFilter] = useState<'all' | 'scheduled' | 'delivered' | 'failed'>('all');
  const [localViewTab, setLocalViewTab] = useState<'telemetry' | 'live_logs'>('telemetry');

  // System Stats Overview
  const [statsOverview, setStatsOverview] = useState({
    totalCloudNotifications: 0,
    dispatchedCount: 0,
    pendingCount: 0,
    totalFCMTokens: 0,
    activeLocalDevices: 0,
    totalLocalAlarms: 0,
    usersWithReminders: 0,
    platforms: { android: 0, ios: 0, web: 0, other: 0 }
  });

  useEffect(() => {
    async function fetchDepartments() {
      const { data, error } = await supabase.from('programs').select('department_name');
      if (data && !error) {
        const unique = Array.from(new Set(data.map((d: any) => d.department_name).filter(Boolean))) as string[];
        unique.sort((a, b) => a.localeCompare(b));
        setDepartments(unique);
      }
    }
    async function fetchVersions() {
      const { data, error } = await supabase.from('profiles').select('app_version').not('app_version', 'is', null);
      if (data && !error) {
        const unique = Array.from(new Set(data.map((d: any) => d.app_version).filter(Boolean))) as string[];
        unique.sort((a, b) => b.localeCompare(a)); 
        setAvailableVersions(unique);
      }
    }
    fetchDepartments();
    fetchVersions();
    fetchHistory();
    fetchLocalNotificationStates();
    fetchLocalNotificationLogs();
    fetchSystemStats();
  }, []);

  const fetchLocalNotificationStates = async () => {
    setLocalStatesLoading(true);
    try {
      const { data, error } = await supabase
        .from('local_notification_states')
        .select('*, profiles(full_name, student_id, department_name)')
        .order('last_scheduled_at', { ascending: false })
        .limit(200);

      if (!error && data) {
        setLocalStates(data as LocalNotificationState[]);
      }
    } catch (e) {
      console.error('Failed to load local notification states:', e);
    } finally {
      setLocalStatesLoading(false);
    }
  };

  const fetchLocalNotificationLogs = async () => {
    setLocalLogsLoading(true);
    try {
      const { data, error } = await supabase
        .from('local_notification_logs')
        .select('*, profiles(full_name, student_id)')
        .order('updated_at', { ascending: false })
        .limit(300);

      if (!error && data) {
        setLocalLogs(data as LocalNotificationLog[]);
      }
    } catch (e) {
      console.error('Failed to load local notification logs:', e);
    } finally {
      setLocalLogsLoading(false);
    }
  };

  const fetchSystemStats = async () => {
    try {
      const [
        totalNotifRes,
        dispatchedRes,
        pendingRes,
        fcmTokensRes,
        profilesReminderRes,
        localStatesCountRes
      ] = await Promise.all([
        supabase.from('notifications').select('*', { count: 'exact', head: true }),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_dispatched', true),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_dispatched', false),
        supabase.from('fcm_tokens').select('*', { count: 'exact', head: true }),
        supabase.from('profiles').select('reminder_settings').not('reminder_settings', 'is', null),
        supabase.from('local_notification_states').select('*')
      ]);

      const activeCustomReminders = (profilesReminderRes.data || []).filter(
        (p: any) => Object.keys(p.reminder_settings || {}).length > 0
      ).length;

      const statesData = localStatesCountRes.data || [];
      const totalAlarms = statesData.reduce((acc: number, curr: any) => acc + (curr.scheduled_count || 0), 0);
      
      const platformsCount: any = { android: 0, ios: 0, web: 0, other: 0 };
      statesData.forEach((s: any) => {
        const p = (s.platform || '').toLowerCase();
        if (p.includes('android')) platformsCount.android++;
        else if (p.includes('ios')) platformsCount.ios++;
        else if (p.includes('web')) platformsCount.web++;
        else platformsCount.other++;
      });

      setStatsOverview({
        totalCloudNotifications: totalNotifRes.count || 0,
        dispatchedCount: dispatchedRes.count || 0,
        pendingCount: pendingRes.count || 0,
        totalFCMTokens: fcmTokensRes.count || 0,
        activeLocalDevices: statesData.length,
        totalLocalAlarms: totalAlarms,
        usersWithReminders: activeCustomReminders,
        platforms: platformsCount
      });
    } catch (e) {
      console.error('Failed to fetch system stats:', e);
    }
  };

  const resetForm = () => {
    setTitle('');
    setMessage('');
    setUrl('');
    setTargetUserId('');
    setTargetDepartment('');
    setTargetStatus('');
    setTargetVersion('');
    setScheduledAt('');
  };

  const sendNotification = async (mode: 'global' | 'department' | 'user' | 'status' | 'version') => {
    if (!title || !message) {
      toast.error('Title and message are required');
      return;
    }

    setLoading(true);
    try {
      let utcIsoString = undefined;
      if (scheduledAt) {
         const bdtDate = new Date(scheduledAt + '+06:00');
         utcIsoString = bdtDate.toISOString();
      }

      const payload: any = {
        title,
        body: message,
        link: url || undefined,
        scheduledAt: utcIsoString
      };

      if (mode === 'user') {
        if (!targetUserId) throw new Error('User UUID is required');
        payload.targetUserId = targetUserId.trim();
      } else if (mode === 'department') {
        if (!targetDepartment) throw new Error('Department is required');
        payload.targetDepartment = targetDepartment;
      } else if (mode === 'status') {
        if (!targetStatus) throw new Error('Status is required');
        payload.targetStatus = targetStatus;
      } else if (mode === 'version') {
        if (!targetVersion) throw new Error('Version is required');
        payload.targetVersion = targetVersion;
      }

      // Secure Cloud-Side Notification Broadcast (invokes Deno Edge Function securely, completely shielding keys)
      const { error: bcastError } = await supabase.functions.invoke('broadcast', {
        body: payload
      });

      if (bcastError) throw bcastError;

      toast.success('Notification deployed successfully!');
      resetForm();
      fetchHistory();
    } catch (err: any) {
      toast.error(err.message || 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .not('alert_key', 'ilike', 'c_%') 
        .order('created_at', { ascending: false })
        .limit(5000);
      
      if (error) throw error;

      const groupedHistory: Record<string, any> = {};
      
      (data || []).forEach((n: any) => {
        let groupKey = n.id; 
        if (n.alert_key) {
          const lastUnderscoreIndex = n.alert_key.lastIndexOf('_');
          groupKey = lastUnderscoreIndex !== -1 ? n.alert_key.substring(0, lastUnderscoreIndex) : n.alert_key;
        }
        
        if (!groupedHistory[groupKey]) {
          groupedHistory[groupKey] = {
            ...n,
            stats: { success: 0, failed: 0 }
          };
        }
        
        if (n.is_dispatched) {
          groupedHistory[groupKey].stats.success++;
        } else {
          groupedHistory[groupKey].stats.failed++;
        }
      });

      setHistory(Object.values(groupedHistory).sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ).slice(0, 50));
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSaveTemplate = () => {
    if (!title || !message) {
      toast.error('Fill in title and message');
      return;
    }
    const name = templateName.trim() || `Template ${templates.length + 1}`;
    const newTemplate: NotificationTemplate = {
      id: Date.now().toString(),
      name,
      title,
      body: message,
      url,
      targetDepartment,
      createdAt: new Date().toISOString()
    };
    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveTemplates(updated);
    setTemplateName('');
    toast.success(`Template saved`);
  };

  const handleLoadTemplate = (t: NotificationTemplate) => {
    setTitle(t.title);
    setMessage(t.body);
    setUrl(t.url);
    setTargetDepartment(t.targetDepartment);
    toast.success(`Loaded: ${t.name}`);
  };

  return (
    <div className="w-full space-y-8 pb-12 animate-in fade-in duration-500">
      {/* Top Header with Multi-View Selector & Quick Stats */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3">
            <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
              <BellRing className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
              Notifications & Local Telemetry
            </h2>
            <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 text-[10px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1.5">
              <Activity className="w-3 h-3 animate-pulse" />
              Real-Time
            </span>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Monitor client-side offline alarms, device telemetry, FCM cloud deliveries, and broadcast campaigns.
          </p>
        </div>

        {/* Action Controls & Navigation Pills */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { fetchHistory(); fetchLocalNotificationStates(); fetchSystemStats(); }}
            className="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5 rounded-2xl hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 transition-colors shadow-sm flex items-center gap-2 text-xs font-bold"
          >
            <RefreshCw className={cn("w-4 h-4", (historyLoading || localStatesLoading) && "animate-spin")} />
            Sync Stats
          </button>

          <div className="bg-gray-100 dark:bg-slate-800/80 p-1.5 rounded-2xl border border-gray-200/60 dark:border-white/5 flex gap-1">
            <button
              onClick={() => setMainView('composer')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                mainView === 'composer'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Send className="w-3.5 h-3.5" />
              Broadcaster
            </button>
            <button
              onClick={() => setMainView('local_stats')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                mainView === 'local_stats'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Smartphone className="w-3.5 h-3.5" />
              Local Device Alarms
              {localStates.length > 0 && (
                <span className="bg-white/20 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1">
                  {localStates.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setMainView('system_health')}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                mainView === 'system_health'
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100 dark:shadow-none"
                  : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
              )}
            >
              <Activity className="w-3.5 h-3.5" />
              System Metrics
            </button>
          </div>
        </div>
      </div>

      {/* Global Stat Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Device Local Schedulers</span>
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Smartphone className="w-4 h-4 text-emerald-500" />
            </div>
          </div>
          <p className="text-2xl font-black text-foreground">{statsOverview.activeLocalDevices}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Active app installations with synced telemetry</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Scheduled 7-Day Alarms</span>
            <div className="p-2 bg-primary/10 rounded-xl">
              <Clock className="w-4 h-4 text-primary" />
            </div>
          </div>
          <p className="text-2xl font-black text-primary">{statsOverview.totalLocalAlarms}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Total alarms queued across student devices</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Custom Reminder Prefs</span>
            <div className="p-2 bg-purple-500/10 rounded-xl">
              <Users className="w-4 h-4 text-purple-500" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-500">{statsOverview.usersWithReminders}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Students with personalized course alert times</p>
        </div>

        <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">Registered FCM Devices</span>
            <div className="p-2 bg-blue-500/10 rounded-xl">
              <Radio className="w-4 h-4 text-blue-500" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-500">{statsOverview.totalFCMTokens}</p>
          <p className="text-[10px] text-muted-foreground mt-1">Push tokens receiving broadcast and alerts</p>
        </div>
      </div>

      {/* VIEW 1: Local Device Alarms & Telemetry */}
      {mainView === 'local_stats' && (
        <div className="space-y-6">
          {/* Sub-Tabs: Device Schedulers vs Live Alarm Logs */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="bg-gray-100 dark:bg-slate-800/80 p-1 rounded-2xl border border-gray-200/60 dark:border-white/5 inline-flex gap-1">
              <button
                onClick={() => setLocalViewTab('telemetry')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  localViewTab === 'telemetry'
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <Smartphone className="w-3.5 h-3.5" />
                Device Telemetry ({localStates.length})
              </button>
              <button
                onClick={() => setLocalViewTab('live_logs')}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2",
                  localViewTab === 'live_logs'
                    ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-white shadow-sm"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                )}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Live Notification Logs ({localLogs.length})
              </button>
            </div>

            {localViewTab === 'live_logs' && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-400">Status Filter:</span>
                {(['all', 'delivered', 'scheduled', 'failed'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setLocalLogFilter(st)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all",
                      localLogFilter === st
                        ? st === 'delivered' ? "bg-emerald-600 text-white" :
                          st === 'failed' ? "bg-rose-600 text-white" :
                          st === 'scheduled' ? "bg-indigo-600 text-white" : "bg-gray-900 dark:bg-white text-white dark:text-slate-900"
                        : "bg-white dark:bg-slate-800 text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-700 border border-gray-200 dark:border-white/5"
                    )}
                  >
                    {st}
                    {st === 'all' ? ` (${localLogs.length})` : ` (${localLogs.filter(l => l.status === st).length})`}
                  </button>
                ))}
              </div>
            )}
          </div>

          {localViewTab === 'telemetry' && (
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
                  <Smartphone className="w-5 h-5 text-emerald-500" />
                  Offline Local Notification Telemetry
                </h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  Device-level records reporting scheduled classes, checksum status, and offline alarms for the 7-day rolling window.
                </p>
              </div>

              <div className="w-full sm:w-72 relative">
                <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter student ID, name, or device..."
                  value={localSearch}
                  onChange={(e) => setLocalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-slate-900 border border-gray-200 dark:border-white/10 rounded-2xl text-xs font-semibold text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            {localStatesLoading ? (
              <div className="p-16 text-center text-gray-400">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                <p className="text-xs font-bold uppercase tracking-widest">Loading telemetry records...</p>
              </div>
            ) : localStates.length === 0 ? (
              <div className="p-16 text-center text-gray-400">
                <Smartphone className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                <p className="font-bold text-sm text-gray-700 dark:text-slate-300">No client telemetry synced yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                  When students open the mobile app, <code className="text-indigo-500 font-mono">syncLocalReminders</code> calculates rolling 7-day classes and syncs active alarm counts to this dashboard.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-white/5">
                {localStates
                  .filter((st) => {
                    if (!localSearch) return true;
                    const q = localSearch.toLowerCase();
                    return (
                      st.device_id.toLowerCase().includes(q) ||
                      st.profiles?.student_id?.toLowerCase().includes(q) ||
                      st.profiles?.full_name?.toLowerCase().includes(q) ||
                      st.platform.toLowerCase().includes(q)
                    );
                  })
                  .map((st) => {
                    const isExpanded = expandedDevice === st.id;
                    return (
                      <div key={st.id} className="py-5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          <div className="flex items-start gap-4 min-w-0">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5">
                              <Smartphone className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-black text-sm text-gray-900 dark:text-white truncate">
                                  {st.profiles?.full_name || 'Anonymous Student'}
                                </span>
                                {st.profiles?.student_id && (
                                  <span className="font-mono text-[10px] font-black bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                    {st.profiles.student_id}
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                  st.platform === 'android' ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' :
                                  st.platform === 'ios' ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300' :
                                  'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300'
                                }`}>
                                  {st.platform}
                                </span>
                                {st.status === 'active' && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                    <CheckCircle2 className="w-3 h-3" />
                                    Active
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
                                <span>Device: <code className="font-mono text-[11px] text-gray-700 dark:text-slate-300">{st.device_id}</code></span>
                                <span>•</span>
                                <span>Semester: <b className="text-gray-900 dark:text-white">{st.semester_code || 'N/A'}</b></span>
                                <span>•</span>
                                <span>App: <b className="text-gray-900 dark:text-white">{st.metadata?.app_version || '2.0.0'}</b></span>
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-6 justify-between lg:justify-end shrink-0 pl-12 lg:pl-0">
                            <div className="text-left lg:text-right">
                              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">
                                {st.scheduled_count} <span className="text-xs font-semibold text-gray-400">alarms</span>
                              </p>
                              <p className="text-[10px] text-gray-400 font-mono">
                                Synced: {new Date(st.last_scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({new Date(st.last_scheduled_at).toLocaleDateString()})
                              </p>
                            </div>

                            <button
                              onClick={() => setExpandedDevice(isExpanded ? null : st.id)}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl text-gray-400 transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        {/* Collapsible Key List & Metadata */}
                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-white/5 pl-12 space-y-3">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-gray-50 dark:bg-slate-900/60 p-4 rounded-2xl">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Routine Hash / Checksum</p>
                                <p className="font-mono text-xs font-bold text-gray-900 dark:text-white mt-0.5 truncate">{st.checksum || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Operating System</p>
                                <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 truncate">{st.metadata?.os_version || 'N/A'}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Next Due Alert</p>
                                <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">
                                  {st.metadata?.next_alert_time ? new Date(st.metadata.next_alert_time).toLocaleString() : 'None in window'}
                                </p>
                              </div>
                            </div>

                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">
                                Active Alert Keys ({st.active_keys?.length || 0})
                              </p>
                              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto custom-scrollbar p-1">
                                {(st.active_keys || []).map((key) => (
                                  <span key={key} className="text-[9px] font-mono bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 px-2 py-0.5 rounded-md text-gray-600 dark:text-slate-400">
                                    {key}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
          )}

          {/* Sub-Tab 2: Individual Local Notification Logs (Scheduled / Delivered / Failed) */}
          {localViewTab === 'live_logs' && (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-100 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
                    <ListFilter className="w-5 h-5 text-indigo-500" />
                    Individual Alarm Execution Logs
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Live record of each device's scheduled alarms, successful deliveries, and caught exceptions.
                  </p>
                </div>
                <button
                  onClick={fetchLocalNotificationLogs}
                  className="p-2.5 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5 rounded-xl hover:bg-gray-50 dark:hover:bg-white/10 text-gray-600 dark:text-slate-300 text-xs font-bold flex items-center gap-2"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", localLogsLoading && "animate-spin")} />
                  Refresh Logs
                </button>
              </div>

              {localLogsLoading ? (
                <div className="p-16 text-center text-gray-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-500" />
                  <p className="text-xs font-bold uppercase tracking-widest">Loading alarm execution records...</p>
                </div>
              ) : localLogs.length === 0 ? (
                <div className="p-16 text-center text-gray-400">
                  <Clock className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
                  <p className="font-bold text-sm text-gray-700 dark:text-slate-300">No local notification logs registered yet</p>
                  <p className="text-xs text-gray-400 mt-1 max-w-md mx-auto">
                    When the app schedules class alarms, it syncs individual alarm rows here. When an alarm triggers, it automatically marks the status as <span className="text-emerald-500 font-bold">delivered</span>.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-gray-50/70 dark:bg-slate-900/60 border-b border-gray-100 dark:border-white/5 text-[9px] font-black uppercase tracking-wider text-gray-400">
                      <tr>
                        <th className="px-6 py-3.5">Student / User</th>
                        <th className="px-6 py-3.5">Alarm Title & Details</th>
                        <th className="px-6 py-3.5">Status</th>
                        <th className="px-6 py-3.5">Trigger Time</th>
                        <th className="px-6 py-3.5">Dispatched / Updated</th>
                        <th className="px-6 py-3.5">Device & Platform</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-white/5">
                      {localLogs
                        .filter(l => localLogFilter === 'all' || l.status === localLogFilter)
                        .map((l) => (
                          <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                            <td className="px-6 py-4">
                              <p className="font-black text-xs text-gray-900 dark:text-white truncate max-w-[150px]">
                                {l.profiles?.full_name || 'Anonymous User'}
                              </p>
                              <p className="text-[10px] font-mono text-gray-400">
                                {l.profiles?.student_id || l.user_id.substring(0, 8) + '...'}
                              </p>
                            </td>

                            <td className="px-6 py-4">
                              <p className="font-bold text-xs text-gray-900 dark:text-white truncate max-w-[240px]">
                                {l.title || l.alert_key}
                              </p>
                              {l.body && (
                                <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate max-w-[240px]">
                                  {l.body}
                                </p>
                              )}
                              <span className="font-mono text-[9px] text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded">
                                {l.alert_key}
                              </span>
                            </td>

                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                l.status === 'delivered' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20' :
                                l.status === 'failed' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20' :
                                'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/20'
                              }`}>
                                {l.status === 'delivered' && <CheckCircle2 className="w-3 h-3" />}
                                {l.status === 'failed' && <XCircle className="w-3 h-3" />}
                                {l.status === 'scheduled' && <Clock className="w-3 h-3" />}
                                {l.status}
                              </span>
                              {l.error_message && (
                                <p className="text-[9px] text-rose-500 mt-1 max-w-[180px] truncate" title={l.error_message}>
                                  {l.error_message}
                                </p>
                              )}
                            </td>

                            <td className="px-6 py-4 text-xs font-mono text-gray-700 dark:text-slate-300">
                              {l.trigger_at ? new Date(l.trigger_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : 'N/A'}
                            </td>

                            <td className="px-6 py-4 text-xs font-mono text-gray-500 dark:text-slate-400">
                              {l.dispatched_at ? (
                                <span className="text-emerald-600 font-bold">
                                  {new Date(l.dispatched_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              ) : (
                                new Date(l.updated_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })
                              )}
                            </td>

                            <td className="px-6 py-4 text-xs">
                              <span className="font-bold text-gray-900 dark:text-white capitalize block">{l.platform}</span>
                              <span className="font-mono text-[10px] text-gray-400 truncate block max-w-[120px]" title={l.device_id}>
                                {l.device_id}
                              </span>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: System Notification & Cron Health */}
      {mainView === 'system_health' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Server className="w-5 h-5 text-indigo-500" />
              Cloud Notification Queue Status
            </h3>
            <p className="text-xs text-gray-400">Summary of the central Supabase notifications table processed by alert-dispatcher.</p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                <p className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Dispatched (Delivered)</p>
                <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{statsOverview.dispatchedCount.toLocaleString()}</p>
                <p className="text-[10px] text-emerald-600/70 mt-1">Successfully sent to student devices</p>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">Pending in Queue</p>
                <p className="text-3xl font-black text-amber-600 dark:text-amber-400 mt-1">{statsOverview.pendingCount.toLocaleString()}</p>
                <p className="text-[10px] text-amber-600/70 mt-1">Awaiting future trigger_at schedule</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-gray-100 dark:border-white/5 text-xs text-gray-500 dark:text-slate-400 space-y-2">
              <div className="flex justify-between items-center">
                <span>Total Historical Notifications:</span>
                <b className="text-gray-900 dark:text-white">{statsOverview.totalCloudNotifications.toLocaleString()}</b>
              </div>
              <div className="flex justify-between items-center">
                <span>Active FCM Push Endpoints:</span>
                <b className="text-gray-900 dark:text-white">{statsOverview.totalFCMTokens.toLocaleString()}</b>
              </div>
              <div className="flex justify-between items-center">
                <span>Dispatcher Health:</span>
                <span className="text-emerald-600 font-bold">Operational (Cron every 10m)</span>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-gray-100 dark:border-white/5 shadow-sm space-y-4">
            <h3 className="text-base font-black text-gray-900 dark:text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-purple-500" />
              Client Architecture & Platforms
            </h3>
            <p className="text-xs text-gray-400">Offline-first local notification deployment distribution.</p>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="font-bold text-xs text-gray-900 dark:text-white">Android (AlarmManager & Darwin)</span>
                </div>
                <span className="font-black text-sm text-gray-900 dark:text-white font-mono">{statsOverview.platforms.android} devices</span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="font-bold text-xs text-gray-900 dark:text-white">iOS (Native UNNotification)</span>
                </div>
                <span className="font-black text-sm text-gray-900 dark:text-white font-mono">{statsOverview.platforms.ios} devices</span>
              </div>

              <div className="flex items-center justify-between p-3.5 bg-gray-50 dark:bg-slate-900/50 rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="font-bold text-xs text-gray-900 dark:text-white">Web / PWA (Browser Notification)</span>
                </div>
                <span className="font-black text-sm text-gray-900 dark:text-white font-mono">{statsOverview.platforms.web} devices</span>
              </div>
            </div>

            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-2xl border border-indigo-100 dark:border-indigo-500/10 text-[11px] text-indigo-700 dark:text-indigo-300 leading-relaxed">
              💡 <b>Hybrid Architecture Active:</b> Class reminders (60m, 30m, 15m, 5m) are triggered directly by student devices without cellular network lag. Server crons only dispatch university broadcasts and emergency cancellations.
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: Broadcaster & Campaign Composer */}
      {mainView === 'composer' && (
        <div className="w-full flex flex-col lg:flex-row gap-8 animate-in fade-in duration-300">
          <div className="flex-1 space-y-8">
            {/* Target Mode Selector */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {[
                { id: 'global', label: 'Global', icon: Target, color: 'bg-indigo-600', sub: 'All Users' },
                { id: 'department', label: 'Dept', icon: Building, color: 'bg-amber-600', sub: 'By Dept' },
                { id: 'status', label: 'Status', icon: ShieldCheck, color: 'bg-emerald-600', sub: 'Onboarding' },
                { id: 'version', label: 'Version', icon: Package, color: 'bg-blue-600', sub: 'App Version' },
                { id: 'user', label: 'Personal', icon: Users, color: 'bg-rose-600', sub: 'Direct UUID' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`p-4 rounded-2xl border-2 text-left transition-all relative overflow-hidden group ${
                    activeTab === tab.id 
                    ? `border-transparent ring-2 ring-offset-2 bg-white dark:bg-slate-800 ring-indigo-500` 
                    : 'border-gray-200 dark:border-white/10 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-white/20'
                  }`}
                >
                  {activeTab === tab.id && (
                    <div className={`absolute inset-0 opacity-10 dark:opacity-20 ${tab.color}`} />
                  )}
                  <tab.icon className={`w-6 h-6 mb-2 transition-colors ${activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400 dark:text-slate-500'}`} />
                  <p className={`font-bold text-sm block ${activeTab === tab.id ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-slate-400'}`}>{tab.label}</p>
                  <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium">{tab.sub}</p>
                </button>
              ))}
            </div>

            {/* Dynamic Form Area */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl shadow-indigo-100/50 dark:shadow-none border border-indigo-50 dark:border-white/5 overflow-hidden transition-all">
              <div className={`h-1.5 w-full ${activeTab === 'global' ? 'bg-indigo-600' : activeTab === 'department' ? 'bg-amber-600' : activeTab === 'status' ? 'bg-emerald-600' : activeTab === 'version' ? 'bg-blue-600' : 'bg-rose-600'}`} />
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                {activeTab === 'global' && '🌍 Global Announcement'}
                {activeTab === 'department' && '🏢 Departmental Circular'}
                {activeTab === 'status' && '🛡️ Status Targeted Alert'}
                {activeTab === 'version' && '📦 Version Specific Deployment'}
                {activeTab === 'user' && '👤 Direct Personal Message'}
              </h3>
              <button onClick={() => setShowTemplates(!showTemplates)} className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-white/5 px-3 py-1.5 rounded-lg transition-colors">
                {showTemplates ? 'CLOSE TEMPLATES' : 'USE TEMPLATE'}
              </button>
            </div>

            {showTemplates && (
              <div className="mb-8 p-6 bg-gray-50 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-gray-200 dark:border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {templates.map(t => (
                    <button key={t.id} onClick={() => handleLoadTemplate(t)} className="p-3 bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/10 rounded-xl text-left hover:border-indigo-400 transition-all">
                      <p className="font-bold text-gray-800 dark:text-slate-200 text-sm truncate">{t.name}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-500 truncate">{t.title}</p>
                    </button>
                  ))}
                </div>
                {templates.length === 0 && <p className="text-center text-gray-400 text-sm italic py-4">No templates</p>}
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notification Title</label>
                  <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-slate-900 p-4 text-sm font-semibold text-slate-900 dark:text-white" placeholder="e.g. Maintenance Alert" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Message Content</label>
                  <textarea rows={4} value={message} onChange={e => setMessage(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-slate-900 p-4 text-sm text-slate-900 dark:text-white" placeholder="Write message..." />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Link (URL)</label>
                  <div className="relative">
                    <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="url" value={url} onChange={e => setUrl(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-slate-900 p-4 pl-12 text-sm text-slate-900 dark:text-white" placeholder="https://..." />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Schedule (Optional)</label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-slate-900 p-4 pl-12 text-sm text-slate-900 dark:text-white" />
                  </div>
                </div>

                {activeTab === 'department' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Target Dept</label>
                    <select value={targetDepartment} onChange={e => setTargetDepartment(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-amber-50 dark:bg-amber-500/5 p-4 text-sm font-bold text-slate-900 dark:text-white">
                      <option value="">Select...</option>
                      {departments.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                )}

                {activeTab === 'status' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">User Status</label>
                    <select value={targetStatus} onChange={e => setTargetStatus(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-emerald-50 dark:bg-emerald-500/5 p-4 text-sm font-bold text-slate-900 dark:text-white">
                      <option value="">Select...</option>
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}

                {activeTab === 'version' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">App Version</label>
                    <select value={targetVersion} onChange={e => setTargetVersion(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-blue-50 dark:bg-blue-500/5 p-4 text-sm font-bold text-slate-900 dark:text-white">
                      <option value="">Select...</option>
                      <option value="legacy">Legacy (None)</option>
                      {availableVersions.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                )}

                {activeTab === 'user' && (
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">User UUID</label>
                    <input type="text" value={targetUserId} onChange={e => setTargetUserId(e.target.value)} className="w-full border-gray-200 dark:border-white/10 rounded-xl bg-rose-50 dark:bg-rose-500/5 p-4 text-sm font-mono text-slate-900 dark:text-white" placeholder="UUID..." />
                  </div>
                )}
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={() => sendNotification(activeTab)} disabled={loading} className={`flex-1 p-4 rounded-2xl text-white font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-3 disabled:opacity-50 ${
                  activeTab === 'global' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200' :
                  activeTab === 'department' ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-200' :
                  activeTab === 'status' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200' :
                  activeTab === 'version' ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-200' :
                  'bg-rose-600 hover:bg-rose-700 shadow-rose-200'
                }`}>
                  <Send className="w-5 h-5" />
                  {loading ? 'Processing...' : 'Deploy Alert'}
                </button>
                <button onClick={handleSaveTemplate} className="bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 p-4 rounded-2xl hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">
                  <BookmarkPlus className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* History Sidebar */}
      <div className="w-full lg:w-96 space-y-6">
        <div className="bg-white dark:bg-slate-800 rounded-3xl border border-gray-200 dark:border-white/5 overflow-hidden flex flex-col h-[750px] shadow-sm">
          <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-gray-50/50 dark:bg-slate-900/50">
            <div className="flex items-center gap-3">
              <History className="w-5 h-5 text-indigo-500" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">History</h3>
            </div>
            <button onClick={fetchHistory} className="p-2 hover:bg-white dark:hover:bg-slate-800 rounded-lg transition-colors text-gray-400">
              <RefreshCw className={cn("w-4 h-4", historyLoading && "animate-spin")} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5 custom-scrollbar">
            {historyLoading && history.length === 0 ? (
              <div className="p-12 text-center text-gray-400 italic">Fetching...</div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-gray-400 italic">No history.</div>
            ) : (
              history.map((n) => (
                <div key={n.id} className="p-5 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 dark:text-white text-sm truncate">{n.title}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 line-clamp-1">{n.body}</p>
                    </div>
                    <button onClick={() => { 
                        setTitle(n.title); setMessage(n.body); setUrl((n.payload as any)?.url || ''); 
                        if (n.alert_key?.startsWith('bcast_')) setActiveTab('global');
                        else if (n.alert_key?.startsWith('dept_')) setActiveTab('department');
                        else if (n.alert_key?.startsWith('status_')) setActiveTab('status');
                        else if (n.alert_key?.startsWith('ver_')) setActiveTab('version');
                        else setActiveTab('user');
                        window.scrollTo({ top: 0, behavior: 'smooth' }); 
                      }} className="p-1.5 text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <div className="flex items-center bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-md px-1.5 py-0.5">
                      <ShieldCheck className="w-3 h-3 text-emerald-600 dark:text-emerald-400 mr-1" />
                      <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{n.stats?.success || 0}</span>
                    </div>
                    <div className="flex items-center bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-md px-1.5 py-0.5">
                      <Users className="w-3 h-3 text-rose-600 dark:text-rose-400 mr-1" />
                      <span className="text-[10px] font-bold text-rose-700 dark:text-rose-400">{n.stats?.failed || 0}</span>
                    </div>
                    <span className="text-[8px] px-1.5 py-0.5 rounded bg-indigo-50 dark:bg-slate-700 text-indigo-600 dark:text-slate-400 font-black uppercase tracking-wider">
                      {n.alert_key?.split('_')[0] || 'Direct'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-gray-400 font-bold uppercase tracking-widest">
                    <span>{new Date(n.trigger_at).toLocaleDateString()}</span>
                    <span>{new Date(n.trigger_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
      )}
    </div>
  );
}
