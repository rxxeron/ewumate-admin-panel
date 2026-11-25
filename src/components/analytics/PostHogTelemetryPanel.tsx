import { useEffect, useState } from 'react';
import {
  ExternalLink, Bug, Activity, MonitorSmartphone, Link2, Check,
  RefreshCcw, Layers, Smartphone, Zap, AlertTriangle, Clock,
  GraduationCap, Users
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from 'recharts';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const POSTHOG_PROJECT_ID = '765838';
const POSTHOG_BASE_URL = `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}`;
const STORAGE_KEY = 'ewumate_posthog_embed_url';

interface PostHogPayload {
  configured: boolean;
  message?: string;
  summary?: {
    dau: number;
    wau: number;
    mau: number;
    totalOpens: number;
    totalScreens: number;
    totalErrors: number;
    avgSessionSec: number;
  };
  dailyTrend?: Array<{ date: string; users: number; opens: number; screens: number; errors: number }>;
  hourlyTrend?: Array<{ hour: string; events: number; users: number }>;
  topScreens?: Array<{ screen: string; views: number; users: number }>;
  appVersions?: Array<{ version: string; platform: string; users: number; events: number }>;
  programBreakdown?: Array<{ program: string; batch: string; users: number; events: number }>;
  featureEvents?: Array<{ event: string; total: number; users: number }>;
  activeUsers?: Array<{
    distinctId: string;
    email: string | null;
    platform: string;
    appVersion: string;
    sessions: number;
    screens: number;
    lastSeen: string;
  }>;
  recentErrors?: Array<{
    type: string;
    message: string;
    context: string;
    appVersion: string;
    platform: string;
    hits: number;
    lastSeen: string;
  }>;
}

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0s';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export function PostHogTelemetryPanel() {
  const defaultEmbed = (import.meta.env.VITE_POSTHOG_EMBED_URL as string | undefined) ?? '';
  const [embedUrl, setEmbedUrl] = useState<string>(() => localStorage.getItem(STORAGE_KEY) || defaultEmbed);
  const [draftUrl, setDraftUrl] = useState(embedUrl);
  const [isEditing, setIsEditing] = useState(false);

  const [days, setDays] = useState<number>(14);
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<PostHogPayload | null>(null);
  const [histStats, setHistStats] = useState<{
    totalUsers: number;
    rollingMau: number;
    rollingYau: number;
    peakActivity: number;
    funnel: { registered: number; courseHistory: number; completed: number; total: number };
  } | null>(null);
  const [proxyError, setProxyError] = useState<string | null>(null);

  const fetchTelemetry = async () => {
    setLoading(true);
    setProxyError(null);
    try {
      const [phRes, histRes] = await Promise.all([
        supabase.functions.invoke('posthog-proxy', { body: { days } }),
        supabase.rpc('get_admin_analytics_stats', { timeframe_days: days }).then((r) => r, () => ({ data: null, error: null })),
      ]);
      if (phRes.error) throw phRes.error;

      const ph = phRes.data as PostHogPayload;
      const hist = histRes?.data as any;

      if (hist) {
        setHistStats({
          totalUsers: Number(hist.stats?.totalUsers ?? 0),
          rollingMau: Number(hist.stats?.rollingMau ?? 0),
          rollingYau: Number(hist.stats?.rollingYau ?? 0),
          peakActivity: Number(hist.stats?.peakActivity ?? 0),
          funnel: {
            registered: Number(hist.funnelData?.registered ?? 0),
            courseHistory: Number(hist.funnelData?.courseHistory ?? 0),
            completed: Number(hist.funnelData?.completed ?? 0),
            total: Number(hist.funnelData?.total ?? 0),
          },
        });
      }

      if (ph?.configured && ph.dailyTrend && hist?.activityData) {
        const histByDate = new Map<string, number>();
        for (const row of hist.activityData as any[]) {
          histByDate.set(String(row.date), Number(row.dau ?? 0));
        }
        ph.dailyTrend = ph.dailyTrend.map((d) => ({
          ...d,
          users: Math.max(d.users, histByDate.get(d.date) ?? 0),
        }));
        if (ph.summary) {
          ph.summary.dau = Math.max(ph.summary.dau, Number(hist.stats?.activeUsers ?? 0));
          ph.summary.mau = Math.max(ph.summary.mau, Number(hist.stats?.rollingMau ?? 0));
        }
      }

      setData(ph);
    } catch (err: any) {
      setProxyError(err?.message ?? 'PostHog proxy unavailable');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetry();
  }, [days]);

  const saveEmbedUrl = () => {
    const trimmed = draftUrl.trim();
    if (trimmed && !trimmed.startsWith('https://')) {
      toast.error('Please enter a valid https:// PostHog shared dashboard URL');
      return;
    }
    if (trimmed) {
      localStorage.setItem(STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
    setEmbedUrl(trimmed);
    setIsEditing(false);
    toast.success(trimmed ? 'PostHog dashboard embedded' : 'Embed URL cleared');
  };

  const maxScreenViews = Math.max(...(data?.topScreens?.map((s) => s.views) ?? [1]), 1);

  return (
    <div className="bg-card border border-border rounded-xl p-6 sm:p-8 shadow-sm space-y-6">
      <div className="flex flex-col md:flex-row justify-between gap-4 md:items-center">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-semibold text-foreground">
              PostHog Behavioral Telemetry & Error Tracking
            </h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Zero DB Load
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Live screen views, session depth & duration, peak hours (BDT), programs, app versions, active users, and errors from Project #{POSTHOG_PROJECT_ID}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2.5 py-2 rounded-lg text-xs font-medium bg-muted border border-border text-foreground"
          >
            <option value={7}>Last 7D</option>
            <option value={14}>Last 14D</option>
            <option value={30}>Last 30D</option>
          </select>
          <button
            onClick={fetchTelemetry}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-accent text-foreground transition-colors"
            title="Refresh PostHog telemetry"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={`${POSTHOG_BASE_URL}/activity/explore`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-accent text-foreground transition-colors"
          >
            <Activity className="w-3.5 h-3.5 text-primary" />
            Live Events
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <a
            href={`${POSTHOG_BASE_URL}/error_tracking`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors"
          >
            <Bug className="w-3.5 h-3.5" />
            Errors
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <button
            onClick={() => {
              setDraftUrl(embedUrl);
              setIsEditing((v) => !v);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            {embedUrl ? 'Change Embed' : 'Embed'}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="p-4 rounded-xl bg-muted/60 border border-border space-y-3">
          <p className="text-xs text-muted-foreground">
            Optional: In PostHog, open any Dashboard → <strong>Share</strong> → enable <strong>Share publicly</strong> → paste the <strong>Embedded iframe URL</strong>:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={draftUrl}
              onChange={(e) => setDraftUrl(e.target.value)}
              placeholder="https://us.posthog.com/embedded/..."
              className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <button
              onClick={saveEmbedUrl}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity"
            >
              <Check className="w-3.5 h-3.5" />
              Save Embed
            </button>
          </div>
        </div>
      )}

      {loading && !data ? (
        <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
          <RefreshCcw className="w-4 h-4 animate-spin text-primary" />
          Loading PostHog telemetry...
        </div>
      ) : data?.configured && data.summary ? (
        <div className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'PostHog DAU', value: data.summary.dau, sub: `WAU: ${data.summary.wau} • MAU: ${data.summary.mau}` },
              { label: `Sessions (${days}D)`, value: data.summary.totalOpens, sub: 'Distinct app sessions' },
              { label: `Screen Views (${days}D)`, value: data.summary.totalScreens, sub: 'GoRouter transitions' },
              {
                label: 'Screens / Session',
                value: data.summary.totalOpens > 0 ? (data.summary.totalScreens / data.summary.totalOpens).toFixed(1) : '0.0',
                sub: 'Avg depth per visit',
              },
              {
                label: 'Avg Session Time',
                value: formatDuration(data.summary.avgSessionSec),
                sub: 'Active engagement',
              },
              { label: `Errors (${days}D)`, value: data.summary.totalErrors, sub: 'Unhandled + caught', danger: data.summary.totalErrors > 0 },
            ].map((card, i) => (
              <div key={i} className="p-4 rounded-xl bg-muted/40 border border-border">
                <p className="text-[11px] font-medium text-muted-foreground">{card.label}</p>
                <p className={`text-2xl font-bold mt-1 ${card.danger ? 'text-rose-500' : 'text-foreground'}`}>{card.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* Daily Trend + Peak Hours */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.dailyTrend && (
              <div className="p-4 rounded-xl bg-muted/20 border border-border">
                <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <MonitorSmartphone className="w-4 h-4 text-primary" />
                  Daily Active Users, Sessions & Screen Views ({days}D)
                </h4>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.dailyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="users" name="Users" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="opens" name="Sessions" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="screens" name="Screens" fill="#8b5cf6" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {data.hourlyTrend && (
              <div className="p-4 rounded-xl bg-muted/20 border border-border">
                <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Peak Usage Hours (Bangladesh Time • Asia/Dhaka)
                </h4>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.hourlyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" vertical={false} />
                      <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                      <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="events" name="Events" fill="#10b981" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="users" name="Unique Users" fill="#6366f1" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Top Screens + App Versions + Programs + Feature Funnel */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Top Screens */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                Top Screens
              </h4>
              <div className="space-y-2.5">
                {(data.topScreens ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No screen events yet.</p>
                ) : (
                  data.topScreens!.map((s, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-xs gap-2">
                        <span className="font-medium text-foreground truncate">{s.screen}</span>
                        <span className="text-muted-foreground shrink-0">{s.views} • {s.users}u</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.round((s.views / maxScreenViews) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* App Versions & Platforms */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-primary" />
                App Versions & Platforms
              </h4>
              <div className="space-y-2">
                {(data.appVersions ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No version data yet.</p>
                ) : (
                  data.appVersions!.map((v, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0 text-xs">
                      <div className="truncate">
                        <span className="font-semibold text-foreground">v{v.version}</span>
                        <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted text-[10px] uppercase text-muted-foreground">{v.platform}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0">{v.users}u • {v.events}e</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Department & Batch */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-primary" />
                Departments & Batches
              </h4>
              <div className="space-y-2">
                {(data.programBreakdown ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">Waiting for identified profiles.</p>
                ) : (
                  data.programBreakdown!.map((p, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0 text-xs">
                      <div className="truncate">
                        <span className="font-semibold text-foreground">{p.program}</span>
                        {p.batch !== '-' && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">{p.batch}</span>
                        )}
                      </div>
                      <span className="text-muted-foreground shrink-0">{p.users}u • {p.events}e</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Feature Events */}
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Feature Usage
              </h4>
              <div className="space-y-2">
                {(data.featureEvents ?? []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No feature events yet.</p>
                ) : (
                  data.featureEvents!.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1.5 border-b border-border/60 last:border-0 text-xs gap-2">
                      <span className="font-mono text-[11px] text-foreground truncate">{f.event}</span>
                      <span className="text-muted-foreground shrink-0">{f.total} ({f.users}u)</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Historical Ecosystem & Onboarding Funnel (Supabase Auth/Profiles) */}
          {histStats && (
            <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  All-Time Ecosystem & Onboarding Funnel (Supabase Profiles)
                </h4>
                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <span>Total Profiles: <strong className="text-foreground">{histStats.totalUsers.toLocaleString()}</strong></span>
                  <span>• Historical MAU: <strong className="text-foreground">{histStats.rollingMau.toLocaleString()}</strong></span>
                  <span>• YAU: <strong className="text-foreground">{histStats.rollingYau.toLocaleString()}</strong></span>
                  <span>• Peak DAU: <strong className="text-foreground">{histStats.peakActivity.toLocaleString()}</strong></span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    label: 'Stage 1: Registered Accounts',
                    count: histStats.funnel.total,
                    pct: 100,
                  },
                  {
                    label: 'Stage 2: Course History Added',
                    count: histStats.funnel.courseHistory + histStats.funnel.completed,
                    pct: histStats.funnel.total > 0 ? Math.round(((histStats.funnel.courseHistory + histStats.funnel.completed) / histStats.funnel.total) * 100) : 0,
                  },
                  {
                    label: 'Stage 3: Onboarding Completed',
                    count: histStats.funnel.completed,
                    pct: histStats.funnel.total > 0 ? Math.round((histStats.funnel.completed / histStats.funnel.total) * 100) : 0,
                  },
                ].map((stage, i) => (
                  <div key={i} className="p-3 rounded-lg bg-background border border-border space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-foreground">{stage.label}</span>
                      <span className="font-semibold text-primary">{stage.count.toLocaleString()} ({stage.pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${stage.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Active Users Table */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              Recently Active Users ({days}D)
            </h4>
            {(data.activeUsers ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No active users recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b border-border">
                      <th className="pb-2 font-medium">User / Distinct ID</th>
                      <th className="pb-2 font-medium">Platform</th>
                      <th className="pb-2 font-medium">Version</th>
                      <th className="pb-2 font-medium text-center">Sessions</th>
                      <th className="pb-2 font-medium text-center">Screens</th>
                      <th className="pb-2 font-medium text-right">Last Seen</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.activeUsers!.map((u, idx) => (
                      <tr key={idx}>
                        <td className="py-2 font-medium text-foreground truncate max-w-[220px]">
                          {u.email || u.distinctId}
                        </td>
                        <td className="py-2 uppercase text-[10px] text-muted-foreground">{u.platform}</td>
                        <td className="py-2 text-muted-foreground">v{u.appVersion}</td>
                        <td className="py-2 text-center font-semibold text-foreground">{u.sessions}</td>
                        <td className="py-2 text-center text-muted-foreground">{u.screens}</td>
                        <td className="py-2 text-right text-muted-foreground">
                          {u.lastSeen ? new Date(u.lastSeen).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Live Errors */}
          <div className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-500" />
              Recent Errors & Exceptions
            </h4>
            {(data.recentErrors ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No client errors recorded in the last {days} days.</p>
            ) : (
              <div className="space-y-2">
                {data.recentErrors!.map((err, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-background border border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-rose-500">{err.type}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-mono text-muted-foreground">{err.context}</span>
                        <span className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">v{err.appVersion} • {err.platform}</span>
                      </div>
                      <p className="text-xs text-foreground mt-1 truncate">{err.message}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="px-2 py-1 rounded-md bg-rose-500/10 text-rose-500 text-xs font-semibold">{err.hits} hits</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-5 bg-muted/20 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            {proxyError
              ? `Deploy the posthog-proxy Edge Function to view native charts here (${proxyError}).`
              : data?.message ?? 'Connect your PostHog Personal API Key to load live charts directly here.'}
          </p>
          <p className="text-xs text-muted-foreground">
            Run: <code className="text-foreground">supabase secrets set POSTHOG_PERSONAL_API_KEY=phx_...</code> and <code className="text-foreground">supabase functions deploy posthog-proxy</code> (or click <strong>Embed</strong> above to pin a shared PostHog dashboard URL).
          </p>
        </div>
      )}

      {embedUrl && (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-background">
          <iframe
            title="PostHog EWUmate Telemetry"
            src={embedUrl}
            className="w-full h-[640px] border-0"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
