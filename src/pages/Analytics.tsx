import { PostHogTelemetryPanel } from '../components/analytics/PostHogTelemetryPanel';

export function Analytics() {
  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-semibold text-foreground tracking-tight">
          Analytics & Telemetry
        </h2>
        <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider mt-1">
          Powered by PostHog • Real-time DAU, Screens, Sessions, Versions & Errors
        </p>
      </div>

      <PostHogTelemetryPanel />
    </div>
  );
}
