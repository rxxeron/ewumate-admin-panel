import { useState } from 'react';
import { ExternalLink, Bug, Activity, MonitorSmartphone, Link2, Check } from 'lucide-react';
import toast from 'react-hot-toast';

const POSTHOG_PROJECT_ID = '765838';
const POSTHOG_BASE_URL = `https://us.posthog.com/project/${POSTHOG_PROJECT_ID}`;
const STORAGE_KEY = 'ewumate_posthog_embed_url';

export function PostHogTelemetryPanel() {
  const defaultEmbed = (import.meta.env.VITE_POSTHOG_EMBED_URL as string | undefined) ?? '';
  const [embedUrl, setEmbedUrl] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || defaultEmbed;
  });
  const [draftUrl, setDraftUrl] = useState(embedUrl);
  const [isEditing, setIsEditing] = useState(false);

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
            Live screen views, daily opens per user, session duration, and unhandled Dart/Web errors from Project #{POSTHOG_PROJECT_ID}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
            href={`${POSTHOG_BASE_URL}/web`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted hover:bg-accent text-foreground transition-colors"
          >
            <MonitorSmartphone className="w-3.5 h-3.5 text-primary" />
            Screens & Sessions
            <ExternalLink className="w-3 h-3 opacity-60" />
          </a>
          <a
            href={`${POSTHOG_BASE_URL}/error_tracking`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-colors"
          >
            <Bug className="w-3.5 h-3.5" />
            Error Tracking
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
            {embedUrl ? 'Change Embed' : 'Embed Dashboard'}
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="p-4 rounded-xl bg-muted/60 border border-border space-y-3">
          <p className="text-xs text-muted-foreground">
            In PostHog, open your Dashboard → <strong>Share</strong> → enable <strong>Share publicly</strong> → copy the <strong>Embedded iframe URL</strong> (e.g. <code className="text-foreground">https://us.posthog.com/embedded/...</code>) and paste it below:
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

      {embedUrl ? (
        <div className="w-full overflow-hidden rounded-xl border border-border bg-background">
          <iframe
            title="PostHog EWUmate Telemetry"
            src={embedUrl}
            className="w-full h-[640px] border-0"
            allowFullScreen
          />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-6 text-center space-y-2 bg-muted/20">
          <p className="text-xs font-medium text-foreground">
            Telemetry is active in Mobile & PWA (`$screen`, `Application Opened`, and `$exception` events).
          </p>
          <p className="text-xs text-muted-foreground">
            Click <strong>Embed Dashboard</strong> above to pin your PostHog charts directly inside this page, or use the quick links to open Live Events, Screens, or Error Tracking.
          </p>
        </div>
      )}
    </div>
  );
}
