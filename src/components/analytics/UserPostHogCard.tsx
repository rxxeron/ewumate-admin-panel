import { useEffect, useState } from 'react';
import { Activity, ExternalLink, RefreshCcw, Smartphone, Layers, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UserTelemetry {
  configured: boolean;
  summary?: {
    sessions: number;
    screens: number;
    errors: number;
    lastSeen: string | null;
    appVersion: string;
    platform: string;
  };
  topScreens?: Array<{ screen: string; views: number }>;
  recentEvents?: Array<{ event: string; detail: string; platform: string; timestamp: string }>;
}

export function UserPostHogCard({ userId }: { userId: string }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserTelemetry | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('posthog-proxy', {
        body: { action: 'user_telemetry', userId, days: 30 },
      });
      if (!error && res) setData(res as UserTelemetry);
    } catch {
      // ignore gracefully
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [userId]);

  const posthogPersonUrl = `https://us.posthog.com/project/765838/persons/${encodeURIComponent(userId)}`;

  return (
    <div className="bg-card rounded-[2rem] p-8 shadow-sm border border-border space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-foreground flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            Live Student Telemetry (PostHog • 30D)
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Individual screen history, sessions, app version, and errors for this student
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-2 rounded-xl bg-muted hover:bg-accent text-foreground transition-colors"
            title="Refresh student telemetry"
          >
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <a
            href={posthogPersonUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
          >
            Open in PostHog
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {loading && !data ? (
        <div className="py-6 text-xs text-muted-foreground flex items-center gap-2">
          <RefreshCcw className="w-3.5 h-3.5 animate-spin text-primary" />
          Loading student telemetry...
        </div>
      ) : data?.configured && data.summary ? (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Sessions (30D)</p>
              <p className="text-xl font-black text-foreground mt-1">{data.summary.sessions}</p>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Screen Views</p>
              <p className="text-xl font-black text-foreground mt-1">{data.summary.screens}</p>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Smartphone className="w-3 h-3" /> Device / App
              </p>
              <p className="text-xs font-bold text-foreground mt-1.5 uppercase">
                {data.summary.platform} • v{data.summary.appVersion}
              </p>
            </div>
            <div className="p-3 rounded-2xl bg-muted/40 border border-border">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Errors (30D)
              </p>
              <p className={`text-xl font-black mt-1 ${data.summary.errors > 0 ? 'text-rose-500' : 'text-foreground'}`}>
                {data.summary.errors}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Most Used Screens
              </p>
              {(data.topScreens ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No PostHog screen views yet for this student.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.topScreens!.map((s, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-border/50 last:border-0">
                      <span className="font-medium text-foreground">{s.screen}</span>
                      <span className="text-muted-foreground">{s.views} views</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 rounded-2xl bg-muted/20 border border-border space-y-2.5">
              <p className="text-xs font-semibold text-foreground">Recent Activity Timeline</p>
              {(data.recentEvents ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No PostHog events recorded in the last 30 days.</p>
              ) : (
                <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                  {data.recentEvents!.map((ev, i) => (
                    <div key={i} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-border/50 last:border-0">
                      <div className="truncate">
                        <span className={`font-mono font-semibold ${ev.event === '$exception' ? 'text-rose-500' : 'text-foreground'}`}>
                          {ev.event}
                        </span>
                        {ev.detail && <span className="text-muted-foreground ml-1.5">({ev.detail})</span>}
                      </div>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {ev.timestamp ? new Date(ev.timestamp).toLocaleString() : ''}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No PostHog telemetry available yet for this student.</p>
      )}
    </div>
  );
}
