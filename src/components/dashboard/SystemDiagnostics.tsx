import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RefreshCcw, Zap, ShieldCheck, Clock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

export function SystemDiagnostics() {
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [infraStatus, setInfraStatus] = useState({
    scraper: 'Pending Diagnostics',
    azure: 'Pending Diagnostics',
    db: 'Pending Diagnostics',
    broadcaster: 'Pending Diagnostics'
  });
  const [infraColors, setInfraColors] = useState({
    scraper: 'bg-slate-300 dark:bg-white/10 text-slate-400',
    azure: 'bg-slate-300 dark:bg-white/10 text-slate-400',
    db: 'bg-slate-300 dark:bg-white/10 text-slate-400',
    broadcaster: 'bg-slate-300 dark:bg-white/10 text-slate-400'
  });

  const checkInfrastructureHealth = async () => {
    setIsCheckingHealth(true);
    const toastId = toast.loading('Running system diagnostics...');
    
    // 1. Check DB Edge Latency
    const startDb = performance.now();
    try {
      const { error } = await supabase.from('profiles').select('id').limit(1).maybeSingle();
      const endDb = performance.now();
      const latency = endDb - startDb;
      
      let status = 'Optimized';
      let color = 'bg-primary text-white';
      if (error) {
        status = 'Error';
        color = 'bg-destructive text-destructive-foreground';
      } else if (latency > 1000) {
        status = 'Lagging';
        color = 'bg-primary text-white';
      } else if (latency > 300) {
        status = 'Operational';
        color = 'bg-primary text-white';
      }
      
      setInfraStatus(prev => ({ ...prev, db: status }));
      setInfraColors(prev => ({ ...prev, db: color }));
    } catch {
      setInfraStatus(prev => ({ ...prev, db: 'Offline' }));
      setInfraColors(prev => ({ ...prev, db: 'bg-destructive text-destructive-foreground' }));
    }

    // 2. Check Azure Function Connectivity (Securely via azure-admin-proxy)
    try {
      const res = await supabase.functions.invoke('azure-admin-proxy', {
        body: { action: 'portal_sync', semester: 'PING', preview: true }
      });
      if (!res.error) {
        setInfraStatus(prev => ({ ...prev, scraper: 'Healthy', azure: 'Live' }));
        setInfraColors(prev => ({ ...prev, scraper: 'bg-primary text-white', azure: 'bg-primary text-white' }));
      } else {
        setInfraStatus(prev => ({ ...prev, scraper: 'Issues', azure: 'Down' }));
        setInfraColors(prev => ({ ...prev, scraper: 'bg-destructive text-destructive-foreground', azure: 'bg-destructive text-destructive-foreground' }));
      }
    } catch {
      setInfraStatus(prev => ({ ...prev, scraper: 'Offline', azure: 'Offline' }));
      setInfraColors(prev => ({ ...prev, scraper: 'bg-destructive text-destructive-foreground', azure: 'bg-destructive text-destructive-foreground' }));
    }

    // 3. Check Broadcaster
    try {
      const { error } = await supabase.functions.invoke('broadcast', {
        body: { ping: true }
      });
      if (!error) {
        setInfraStatus(prev => ({ ...prev, broadcaster: 'Idle' }));
        setInfraColors(prev => ({ ...prev, broadcaster: 'bg-slate-400 text-white' }));
      } else {
        setInfraStatus(prev => ({ ...prev, broadcaster: 'Issues' }));
        setInfraColors(prev => ({ ...prev, broadcaster: 'bg-destructive text-destructive-foreground' }));
      }
    } catch {
      setInfraStatus(prev => ({ ...prev, broadcaster: 'Offline' }));
      setInfraColors(prev => ({ ...prev, broadcaster: 'bg-destructive text-destructive-foreground' }));
    }

    setIsCheckingHealth(false);
    toast.success('Diagnostics completed successfully!', { id: toastId });
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-start sm:items-center mb-8">
        <div>
          <h3 className="text-lg font-semibold tracking-tight text-foreground">System Infrastructure</h3>
          <p className="text-xs font-bold text-muted-foreground   mt-0.5">Diagnostics & Cloud Telemetry</p>
        </div>
        <button 
          onClick={checkInfrastructureHealth}
          disabled={isCheckingHealth}
          className={cn(
            "text-xs font-semibold px-4 py-2.5 rounded-lg transition-all   flex items-center gap-2 border",
            isCheckingHealth 
              ? "bg-muted text-muted-foreground border-border cursor-not-allowed"
              : "bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 shadow-sm"
          )}
        >
          {isCheckingHealth ? (
            <>
              <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
              Running...
            </>
          ) : (
            'Run Diagnostics'
          )}
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Portal Scraper', status: infraStatus.scraper, icon: Zap, color: infraColors.scraper },
          { label: 'Azure Core', status: infraStatus.azure, icon: ShieldCheck, color: infraColors.azure },
          { label: 'Cloud DB', status: infraStatus.db, icon: Clock, color: infraColors.db },
          { label: 'Broadcaster', status: infraStatus.broadcaster, icon: Mail, color: infraColors.broadcaster }
        ].map((sys, i) => (
          <div key={i} className="p-4 bg-muted/50 rounded-lg border flex items-center justify-between group hover:bg-card hover:border-primary/30 transition-all">
            <div className="flex items-center gap-4">
              <div className="p-2 rounded-lg bg-background shadow-sm group-hover:scale-110 transition-transform">
                <sys.icon className="w-5 h-5 text-foreground" />
              </div>
              <div>
                <h4 className="text-xs font-semibold text-foreground">{sys.label}</h4>
                <p className="text-xs font-bold text-muted-foreground  ">{sys.status}</p>
              </div>
            </div>
            <div className={cn("w-2 h-2 rounded-full", sys.color)} />
          </div>
        ))}
      </div>
    </>
  );
}
