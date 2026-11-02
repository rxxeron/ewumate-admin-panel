import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Settings as SettingsIcon, RefreshCw, Globe, Image as ImageIcon, Heart, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

export function Settings() {
  const [loading, setLoading] = useState(true);
  const [versionStats, setVersionStats] = useState<Record<string, { count: number, students: any[] }>>({});
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(new Set());
  const [updateConfig, setUpdateConfig] = useState<any>(null);
  const [adConfig, setAdConfig] = useState<any>(null);
  const [promoBanner, setPromoBanner] = useState<any>(null);
  const [donationConfig, setDonationConfig] = useState<any>({ key: 'donation_popup', value: { is_active: false } });
  const [bannerPreviewError, setBannerPreviewError] = useState(false);

  useEffect(() => {
    fetchConfigs();
    fetchVersionStats();
  }, []);

  async function fetchVersionStats() {
    try {
      const { data } = await supabase.from('profiles').select('app_version, full_name, student_id');
      if (data) {
        const stats: Record<string, { count: number, students: any[] }> = {};
        data.forEach((p: any) => {
          const v = p.app_version || 'Unknown / Older';
          if (!stats[v]) stats[v] = { count: 0, students: [] };
          stats[v].count++;
          stats[v].students.push(p);
        });
        setVersionStats(stats);
      }
    } catch (e) {
      console.error('Failed to fetch version stats:', e);
    }
  }

  const toggleVersionExpand = (version: string) => {
    const newExpanded = new Set(expandedVersions);
    if (newExpanded.has(version)) {
      newExpanded.delete(version);
    } else {
      newExpanded.add(version);
    }
    setExpandedVersions(newExpanded);
  };

  async function fetchConfigs(silent = false) {
    if (!silent) setLoading(true);
    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .order('key', { ascending: true });

    if (!error && data) {
      const updateInfo = data.find((c: any) => c.key === 'update_info');
      if (updateInfo) setUpdateConfig(updateInfo);

      const ads = data.find((c: any) => c.key === 'ad_settings');
      if (ads) {
        const val = ads.value || {};
        const mergedVal = {
          is_enabled: val.is_enabled ?? true,
          banner_enabled: val.banner_enabled ?? true,
          native_enabled: val.native_enabled ?? true,
          interstitial_enabled: val.interstitial_enabled ?? true,
          screens: {
            pre_advising: val.screens?.pre_advising ?? true,
            cover_page: val.screens?.cover_page ?? true,
            semester_progress: val.screens?.semester_progress ?? true,
            degree_progress: val.screens?.degree_progress ?? true,
            course_browser: val.screens?.course_browser ?? true,
            faculty_directory: val.screens?.faculty_directory ?? true,
            services: val.screens?.services ?? true,
            study_vault: val.screens?.study_vault ?? true,
            tasks: val.screens?.tasks ?? true,
            ...(val.screens || {})
          }
        };
        setAdConfig({ ...ads, value: mergedVal });
      } else {
        setAdConfig({
          key: 'ad_settings',
          value: {
            is_enabled: true,
            banner_enabled: true,
            native_enabled: true,
            interstitial_enabled: true,
            screens: {
              pre_advising: true,
              cover_page: true,
              semester_progress: true,
              degree_progress: true,
              course_browser: true,
              faculty_directory: true,
              services: true,
              study_vault: true,
              tasks: true
            }
          }
        });
      }

      const banner = data.find((c: any) => c.key === 'promo_banner');
      if (banner) {
        setPromoBanner({ ...banner, value: banner.value || { is_active: false, image_url: '', link_url: '' } });
      } else {
        setPromoBanner({ key: 'promo_banner', value: { is_active: false, image_url: '', link_url: '' } });
      }

      const donation = data.find((c: any) => c.key === 'donation_popup');
      if (donation) {
        setDonationConfig({ ...donation, value: donation.value || { is_active: false } });
      } else {
        setDonationConfig({ key: 'donation_popup', value: { is_active: false } });
      }
    }
    if (!silent) setLoading(false);
  }

  const handleAdSettingsUpdate = async (updatedValue: any) => {
    setAdConfig((prev: any) => ({ ...prev, value: updatedValue }));

    const { data: checkData } = await supabase.from('app_config').select('key').eq('key', 'ad_settings').maybeSingle();
    let error;
    if (checkData) {
      const { error: updateError } = await supabase.from('app_config').update({ value: updatedValue }).eq('key', 'ad_settings');
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('app_config').insert([{ key: 'ad_settings', value: updatedValue }]);
      error = insertError;
    }
    if (error) { toast.error('Failed to update ad configurations: ' + error.message); await fetchConfigs(true); }
    else { toast.success(`Monetization settings saved successfully!`); await fetchConfigs(true); }
  };

  const handlePromoBannerUpdate = async (updatedValue: any) => {
    setPromoBanner((prev: any) => ({ ...prev, value: updatedValue }));
    setBannerPreviewError(false);

    const { data: checkData } = await supabase.from('app_config').select('key').eq('key', 'promo_banner').maybeSingle();
    let error;
    if (checkData) {
      const { error: updateError } = await supabase.from('app_config').update({ value: updatedValue }).eq('key', 'promo_banner');
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('app_config').insert([{ key: 'promo_banner', value: updatedValue }]);
      error = insertError;
    }
    if (error) { toast.error('Failed to save banner: ' + error.message); await fetchConfigs(true); }
    else { toast.success('Promo banner saved!'); await fetchConfigs(true); }
  };

  const handleDonationConfigUpdate = async (updatedValue: any) => {
    setDonationConfig((prev: any) => ({ ...prev, value: updatedValue }));

    const { data: checkData } = await supabase.from('app_config').select('key').eq('key', 'donation_popup').maybeSingle();
    let error;
    if (checkData) {
      const { error: updateError } = await supabase.from('app_config').update({ value: updatedValue }).eq('key', 'donation_popup');
      error = updateError;
    } else {
      const { error: insertError } = await supabase.from('app_config').insert([{ key: 'donation_popup', value: updatedValue }]);
      error = insertError;
    }
    if (error) { toast.error('Failed to save donation config: ' + error.message); await fetchConfigs(true); }
    else { toast.success('Donation popup configuration saved!'); await fetchConfigs(true); }
  };

  const handleUpdate = async (itemKey: string, updates: any) => {
    // Optimistic state update if update_info
    if (itemKey === 'update_info') {
      setUpdateConfig((prev: any) => ({
        ...prev,
        ...updates
      }));
    }

    const { error } = await supabase
      .from('app_config')
      .update(updates)
      .eq('key', itemKey);

    if (error) {
      toast.error('Failed to update config: ' + error.message);
      await fetchConfigs(true);
    } else {
      toast.success('Configuration saved');
      await fetchConfigs(true);
    }
  };

  const handleFlushCache = async () => {
    const toastId = toast.loading('Flushing global user cache...');
    try {
      const newVersion = Date.now();
      const val = { version: newVersion, updated_at: new Date().toISOString() };

      const { data: checkData } = await supabase.from('app_config').select('key').eq('key', 'catalog_cache_version').maybeSingle();
      if (checkData) {
        await supabase.from('app_config').update({ value: val }).eq('key', 'catalog_cache_version');
      } else {
        await supabase.from('app_config').insert([{ key: 'catalog_cache_version', value: val }]);
      }
      toast.success('Global user cache flushed! Mobile apps will re-sync.', { id: toastId });
    } catch (e: any) {
      toast.error('Failed to flush cache: ' + e.message, { id: toastId });
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 w-full">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-3">
          <SettingsIcon className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          App Config & Version CMS
        </h2>
        <div className="flex items-center gap-3">
          <button
            onClick={handleFlushCache}
            className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg shadow-sm text-sm font-medium flex items-center gap-2 transition-all cursor-pointer"
            title="Force all mobile app users to clear local course cache and re-download fresh data"
          >
            <Zap className="w-4 h-4" /> Flush All Users' Cache
          </button>
          <button
            onClick={() => { fetchConfigs(); fetchVersionStats(); }}
            className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-white/5 px-4 py-2 rounded-lg shadow-sm text-sm font-medium hover:bg-gray-50 dark:hover:bg-white/10 flex items-center gap-2 transition-all text-slate-700 dark:text-slate-300"
          >
            <RefreshCw className="w-4 h-4" /> Refresh Data
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {/* Version Management Card */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 bg-muted/40 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-primary" />
                Active Version Settings
              </h3>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Target Live Version</label>
                  <input 
                    type="text"
                    defaultValue={updateConfig?.latest_version || ''}
                    onBlur={(e) => handleUpdate('update_info', { latest_version: e.target.value })}
                    className="w-full border border-border rounded-xl bg-background p-3 text-sm focus:ring-2 focus:ring-primary transition-all font-mono text-foreground placeholder:text-muted-foreground"
                    placeholder="e.g. 2.0.1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Update Download URL</label>
                  <input 
                    type="text"
                    defaultValue={updateConfig?.download_url || ''}
                    onBlur={(e) => handleUpdate('update_info', { download_url: e.target.value })}
                    className="w-full border border-border rounded-xl bg-background p-3 text-sm focus:ring-2 focus:ring-primary transition-all text-foreground placeholder:text-muted-foreground"
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Show Update Prompt to Users</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-500">When enabled, students on older versions will see the update alert.</p>
                </div>
                <button
                  onClick={() => handleUpdate('update_info', { value: { ...updateConfig?.value, update_available: !updateConfig?.value?.update_available } })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${updateConfig?.value?.update_available ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${updateConfig?.value?.update_available ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>
            </div>
          </div>

          {/* AdMob Monetization Controls Card */}
          <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 bg-muted/40 border-b border-border">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                AdMob Monetization Controls
              </h3>
            </div>
            <div className="p-6 space-y-6">
              {/* Master Global Toggle */}
              <div className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border">
                <div>
                  <h4 className="font-bold text-foreground">Enable Mobile Advertisements (Master Switch)</h4>
                  <p className="text-xs text-muted-foreground mt-1">When disabled, all ads are turned off instantly across the entire app regardless of other settings.</p>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    const nextVal = !adConfig?.value?.is_enabled;
                    await handleAdSettingsUpdate({ ...adConfig?.value, is_enabled: nextVal });
                  }}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${adConfig?.value?.is_enabled ? 'bg-emerald-500' : 'bg-muted border border-border'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${adConfig?.value?.is_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {adConfig?.value?.is_enabled && (
                <div className="space-y-6 border-t border-border pt-6">
                  {/* Format Toggles */}
                  <div>
                    <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-4">Ad Format Toggles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {[
                        { key: 'banner_enabled', title: 'Banner Ads', desc: 'Tiny rectangular ads at bottom slots.' },
                        { key: 'native_enabled', title: 'Native Ads', desc: 'Grid style tile ads matching content layout.' },
                        { key: 'interstitial_enabled', title: 'Interstitial Ads', desc: 'Full-screen ads during action triggers.' }
                      ].map((format) => (
                        <div key={format.key} className="flex items-center justify-between p-4 bg-muted/20 rounded-xl border border-border">
                          <div className="mr-4">
                            <h5 className="font-bold text-sm text-foreground">{format.title}</h5>
                            <p className="text-[10px] text-muted-foreground mt-0.5">{format.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const nextVal = !adConfig?.value?.[format.key];
                              await handleAdSettingsUpdate({ ...adConfig?.value, [format.key]: nextVal });
                            }}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors cursor-pointer shrink-0 ${adConfig?.value?.[format.key] ? 'bg-primary' : 'bg-muted border border-border'}`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${adConfig?.value?.[format.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Screen Placement Toggles */}
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-4">Screen Placement Toggles</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {[
                        { key: 'pre_advising', title: 'Pre-Advising Interstitials', desc: 'Ad shown before schedule combinations.' },
                        { key: 'cover_page', title: 'Cover Page Interstitials', desc: 'Ad shown before PDF report download.' },
                        { key: 'semester_progress', title: 'Semester Progress Banners', desc: 'Banner placed on progress view.' },
                        { key: 'degree_progress', title: 'Degree Progress Native', desc: 'Grid ad placed under credits tracker.' },
                        { key: 'course_browser', title: 'Course Browser Native', desc: 'Grid ad embedded in directory list.' },
                        { key: 'faculty_directory', title: 'Faculty Directory Native', desc: 'Tile ad in teacher browser lists.' },
                        { key: 'services', title: 'Services Tab Native', desc: 'Integrated tile inside support services.' },
                        { key: 'study_vault', title: 'Study Vault Native', desc: 'Tile placed inside materials vault.' },
                        { key: 'tasks', title: 'Tasks Manager Native', desc: 'Pastel red tile placed under personal tasks.' }
                      ].map((screen) => (
                        <div key={screen.key} className="flex items-center justify-between p-3.5 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-gray-100 dark:border-white/5">
                          <div className="mr-4">
                            <h5 className="font-bold text-xs text-gray-900 dark:text-white">{screen.title}</h5>
                            <p className="text-[9px] text-gray-500 dark:text-slate-500 mt-0.5">{screen.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const nextScreens = {
                                ...adConfig?.value?.screens,
                                [screen.key]: !adConfig?.value?.screens?.[screen.key]
                              };
                              await handleAdSettingsUpdate({ ...adConfig?.value, screens: nextScreens });
                            }}
                            className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors cursor-pointer shrink-0 ${adConfig?.value?.screens?.[screen.key] ? 'bg-indigo-500' : 'bg-gray-200 dark:bg-slate-700'}`}
                          >
                            <span className={`inline-block h-3  w-3 transform rounded-full bg-white transition-transform ${adConfig?.value?.screens?.[screen.key] ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Promo Banner Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-pink-100 dark:border-white/5 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-pink-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-pink-100 dark:border-white/5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                Promo Banner (Dashboard Top)
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Displays a clickable image/GIF at the very top of the student dashboard. Changes are live instantly — no app update needed.</p>
            </div>
            <div className="p-6 space-y-5">
              {/* Active toggle */}
              <div className="flex items-center justify-between p-4 bg-pink-50/30 dark:bg-pink-500/5 rounded-xl border border-pink-100 dark:border-pink-500/10">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Show Banner to Users</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">When off, the banner is completely hidden with no layout impact.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handlePromoBannerUpdate({ ...promoBanner?.value, is_active: !promoBanner?.value?.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                    promoBanner?.value?.is_active ? 'bg-pink-500' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    promoBanner?.value?.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>

              {/* Image URL */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Image / GIF URL</label>
                <input
                  key={promoBanner?.value?.image_url}
                  type="text"
                  defaultValue={promoBanner?.value?.image_url || ''}
                  onBlur={(e) => {
                    setBannerPreviewError(false);
                    handlePromoBannerUpdate({ ...promoBanner?.value, image_url: e.target.value.trim() });
                  }}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-slate-900 p-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all text-slate-900 dark:text-white"
                  placeholder="https://example.com/banner.gif"
                />
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5 bg-pink-50 dark:bg-pink-500/10 text-pink-600 dark:text-pink-400 text-xs font-black px-3 py-1 rounded-full border border-pink-200 dark:border-pink-500/20 tracking-wide">
                    📐 800 × 120 px
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 dark:border-white/10">
                    5 : 1 ratio
                  </span>
                  <span className="inline-flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 text-xs font-semibold px-3 py-1 rounded-full border border-slate-200 dark:border-white/10">
                    GIF supported ✓
                  </span>
                </div>
              </div>

              {/* Link URL */}
              <div>
                <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Tap Destination URL</label>
                <input
                  key={promoBanner?.value?.link_url}
                  type="text"
                  defaultValue={promoBanner?.value?.link_url || ''}
                  onBlur={(e) => handlePromoBannerUpdate({ ...promoBanner?.value, link_url: e.target.value.trim() })}
                  className="w-full border border-gray-200 dark:border-white/10 rounded-xl bg-gray-50 dark:bg-slate-900 p-3 text-sm focus:ring-2 focus:ring-pink-500 transition-all text-slate-900 dark:text-white"
                  placeholder="https://your-destination.com"
                />
                <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-1">Leave blank to make the banner non-clickable.</p>
              </div>

              {/* Live Preview */}
              {promoBanner?.value?.image_url && (
                <div>
                  <label className="block text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2">Live Preview</label>
                  <div className="rounded-2xl overflow-hidden border border-gray-100 dark:border-white/5 bg-slate-900" style={{ height: 120 }}>
                    {bannerPreviewError ? (
                      <div className="flex items-center justify-center h-full text-red-400 text-sm gap-2">
                        <ImageIcon className="w-4 h-4" /> Failed to load image — check the URL
                      </div>
                    ) : (
                      <img
                        src={promoBanner.value.image_url}
                        alt="Banner preview"
                        className="w-full h-full object-cover"
                        onError={() => setBannerPreviewError(true)}
                      />
                    )}
                  </div>
                  {promoBanner?.value?.link_url && (
                    <p className="text-[10px] text-gray-400 dark:text-slate-600 mt-2">
                      → Tapping opens: <span className="text-pink-500 font-mono">{promoBanner.value.link_url}</span>
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Donation Popup Settings Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-pink-100 dark:border-white/5 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-pink-50 to-white dark:from-slate-900 dark:to-slate-800 border-b border-pink-100 dark:border-white/5">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500 dark:text-pink-400" />
                Donation Popup Settings
              </h3>
              <p className="text-xs text-gray-500 dark:text-slate-500 mt-1">Controls the server support popup displayed to active students. Changes are live instantly.</p>
            </div>
            <div className="p-6">
              {/* Active toggle */}
              <div className="flex items-center justify-between p-4 bg-pink-50/30 dark:bg-pink-500/5 rounded-xl border border-pink-100 dark:border-pink-500/10">
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white">Enable Donation Popup</h4>
                  <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">When active, students will see a once-per-day prompt to support hosting costs.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDonationConfigUpdate({ ...donationConfig?.value, is_active: !donationConfig?.value?.is_active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                    donationConfig?.value?.is_active ? 'bg-pink-500' : 'bg-gray-200 dark:bg-slate-700'
                  }`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    donationConfig?.value?.is_active ? 'translate-x-6' : 'translate-x-1'
                  }`} />
                </button>
              </div>
            </div>
          </div>

          {/* Available Versions List */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden">
            <div className="p-6 border-b border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-slate-900/50">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Detected App Versions & User Adoption</h3>
              <p className="text-xs text-gray-500 dark:text-slate-500">Live breakdown of which versions your students are currently using.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 divide-y md:divide-y-0 divide-gray-100 dark:divide-white/5">
              {Object.entries(versionStats).sort((a, b) => b[1].count - a[1].count).map(([version, data], idx) => {
                const totalUsers = Object.values(versionStats).reduce((acc, curr) => acc + curr.count, 0);
                const percentage = totalUsers > 0 ? (data.count / totalUsers) * 100 : 0;
                const isLatest = version === updateConfig?.latest_version;
                const isExpanded = expandedVersions.has(version);

                return (
                  <div key={version} className={cn(
                    "hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors border-gray-100 dark:border-white/5",
                    idx % 2 !== 1 && "md:border-r",
                    (idx + 1) % 3 !== 0 && "lg:border-r",
                    "border-b"
                  )}>
                    <div 
                      onClick={() => toggleVersionExpand(version)}
                      className="p-6 flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-lg font-mono font-bold truncate ${isLatest ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-700 dark:text-slate-300'}`}>
                            {/^\d/.test(version) ? `v${version}` : version}
                          </span>
                          {isLatest && (
                            <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider shrink-0">
                              Live
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex-1 bg-gray-100 dark:bg-slate-900 rounded-full h-1.5">
                            <div 
                              className={`h-1.5 rounded-full transition-all duration-1000 ${isLatest ? 'bg-indigo-500' : 'bg-gray-400 dark:bg-slate-700'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 dark:text-slate-500 font-black uppercase tracking-widest shrink-0">
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right ml-6 shrink-0">
                        <p className="text-xl font-black text-gray-900 dark:text-white leading-none">{data.count}</p>
                        <p className="text-[9px] font-black text-gray-400 dark:text-slate-500 uppercase tracking-widest mt-1">Users</p>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-6 pb-6 bg-gray-50/30 dark:bg-slate-900/30">
                        <div className="border border-gray-200 dark:border-white/5 rounded-xl overflow-hidden shadow-sm">
                          <table className="w-full text-left text-sm">
                            <thead className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-white/5 text-gray-400 dark:text-slate-500 text-[9px] font-black uppercase tracking-widest">
                              <tr>
                                <th className="px-3 py-2">Name</th>
                                <th className="px-3 py-2 text-right">ID</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 dark:divide-white/5 bg-white dark:bg-slate-800">
                              {data.students.slice(0, 50).map((student: any) => (
                                <tr key={student.student_id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                  <td className="px-3 py-2 font-bold text-slate-700 dark:text-slate-300 text-xs truncate max-w-[120px]">{student.full_name || 'N/A'}</td>
                                  <td className="px-3 py-2 font-mono text-slate-500 dark:text-slate-500 text-[10px] text-right">{student.student_id || 'N/A'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {Object.keys(versionStats).length === 0 && (
                <div className="col-span-2 p-12 text-center text-gray-500 dark:text-slate-500 italic">
                  No version data detected from students yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}