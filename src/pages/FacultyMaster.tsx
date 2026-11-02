import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Users, Search, Mail, Phone, Filter, ChevronLeft, ChevronRight, 
  RefreshCw, Loader2, Building2, DoorClosed, UserPlus, X, 
  AlertTriangle, CheckCircle2 
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Faculty } from '../types';
import { Skeleton } from '../components/Skeleton';

interface NewFacultyInfo {
  source?: string;
  short_name?: string;
  full_name: string;
  designation?: string;
  department?: string;
  office_room?: string | null;
  email?: string;
  photo_url?: string | null;
}

export function FacultyMaster() {
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 100;

  const [stats, setStats] = useState({ total: 0, filtered: 0, withRooms: 0 });
  
  // Sync state
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{ type: 'success' | 'warning' | 'error'; message: string } | null>(null);
  const [newFaculties, setNewFaculties] = useState<NewFacultyInfo[]>([]);
  const [showNewModal, setShowNewModal] = useState(false);

  useEffect(() => {
    fetchFaculty();
  }, [page, searchTerm]);

  async function fetchFaculty() {
    setLoading(true);
    let query = supabase
      .from('faculty_master')
      .select('*', { count: 'exact' })
      .order('short_name', { ascending: true })
      .range(page * pageSize, (page + 1) * pageSize - 1);

    if (searchTerm) {
      query = query.or(`full_name.ilike.%${searchTerm}%,short_name.ilike.%${searchTerm}%,office_room.ilike.%${searchTerm}%`);
    }

    const { data, error, count } = await query;

    if (!error && data) {
      setFaculty(data as Faculty[]);
      setStats(prev => ({ 
        total: searchTerm ? prev.total : (count || 0), 
        filtered: count || 0,
        withRooms: prev.withRooms
      }));
    }

    // Total and rooms count if not searching
    if (!searchTerm && !stats.total) {
      const { count: totalCount } = await supabase.from('faculty_master').select('*', { count: 'exact', head: true });
      const { count: roomCount } = await supabase.from('faculty_master').select('*', { count: 'exact', head: true }).not('office_room', 'is', null);
      setStats(prev => ({ 
        ...prev, 
        total: totalCount || 0,
        withRooms: roomCount || 0
      }));
    }

    setLoading(false);
  }

  async function handleSyncFacultyMaster() {
    setIsSyncing(true);
    setSyncNotice(null);

    try {
      const { data, error } = await supabase.functions.invoke('azure-admin-proxy', {
        body: { action: 'faculty_sync' }
      });

      if (error) throw error;

      const detectedNew = (data?.new_faculties || []) as NewFacultyInfo[];
      const roomsUpdated = data?.stats?.rooms_updated || 0;

      // Selective display: Show modal ONLY IF new faculty detected
      if (detectedNew.length > 0) {
        setNewFaculties(detectedNew);
        setShowNewModal(true);
      } else {
        setSyncNotice({
          type: 'success',
          message: data?.message || `Faculty Master successfully synchronized. ${roomsUpdated} office rooms & directory profiles refreshed. No new faculty members detected.`
        });
      }

      if (data?.warning) {
        setSyncNotice({
          type: 'warning',
          message: data.warning
        });
      }

      // Refresh faculty list and room counts
      const { count: roomCount } = await supabase.from('faculty_master').select('*', { count: 'exact', head: true }).not('office_room', 'is', null);
      setStats(prev => ({ ...prev, withRooms: roomCount || 0 }));
      await fetchFaculty();

    } catch (err: any) {
      console.error("Faculty Master Sync Error:", err);
      setSyncNotice({
        type: 'error',
        message: err.message || 'Failed to trigger Faculty Master update via Azure.'
      });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header with Title and Sync Action */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-4">
             <div className="p-3 bg-primary rounded-lg text-white shadow-lg shadow-sm dark:shadow-none">
               <Users className="w-6 h-6" />
             </div>
             Faculty Master
          </h2>
          <div className="flex flex-wrap items-center gap-2 mt-2 ml-1">
             <p className="text-muted-foreground text-xs font-semibold uppercase">Central Directory</p>
             <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
             <p className="text-primary dark:text-primary text-xs font-semibold uppercase tracking-wider">{stats.total.toLocaleString()} Professors</p>
             {stats.withRooms > 0 && (
               <>
                 <div className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                 <p className="text-amber-600 dark:text-amber-400 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
                   <DoorClosed className="w-3.5 h-3.5" />
                   {stats.withRooms.toLocaleString()} Office Rooms
                 </p>
               </>
             )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncFacultyMaster}
            disabled={isSyncing}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-xl shadow-md shadow-primary/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed group cursor-pointer"
            title="Harvest fresh faculty data and office room numbers via Azure"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Syncing on Azure...</span>
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 group-hover:rotate-180 transition-transform duration-500" />
                <span>Update Faculty Master</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sync Notification Banner */}
      {syncNotice && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 animate-in fade-in duration-300 ${
          syncNotice.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-400' :
          syncNotice.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-400' :
          'bg-destructive/10 border-destructive/20 text-destructive'
        }`}>
          <div className="flex items-start gap-3">
            {syncNotice.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> :
             syncNotice.type === 'warning' ? <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" /> :
             <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />}
            <p className="text-sm font-medium">{syncNotice.message}</p>
          </div>
          <button 
            onClick={() => setSyncNotice(null)}
            className="p-1 hover:bg-black/5 dark:hover:bg-white/5 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Bar */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl p-4 sm:p-6 rounded-lg sm:rounded-[2.5rem] border border-border dark:border-border shadow-sm space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3 text-foreground">
             <Filter className="w-4 h-4" />
             <span className="text-[10px] font-semibold uppercase tracking-wider">Search Faculty Hub</span>
          </div>
          {searchTerm && (
            <span className="text-[10px] font-semibold text-primary dark:text-primary uppercase tracking-wider bg-primary/10 dark:bg-primary/10 px-3 py-1 rounded-full border border-primary/20 dark:border-primary/20">
              {stats.filtered} Results Found
            </span>
          )}
        </div>
        
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-transform group-focus-within:scale-110">
            <Search className="h-4 w-4 text-slate-400 dark:text-slate-600 group-focus-within:text-primary" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            className="block w-full pl-12 pr-4 py-3.5 bg-background border border-slate-100 dark:border-border rounded-lg text-sm font-bold text-foreground placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none transition-all"
            placeholder="Search by name, initials, or room number (e.g. 807, AIA)..."
          />
        </div>
      </div>

      {/* Faculty Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {loading ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card p-6 rounded-lg border border-border space-y-4 shadow-sm">
              <Skeleton className="w-16 h-16 rounded-lg" />
              <Skeleton className="w-3/4 h-6 rounded-lg" />
              <Skeleton className="w-1/2 h-4 rounded-lg" />
              <div className="pt-4 space-y-2">
                <Skeleton className="w-full h-4 rounded-lg" />
                <Skeleton className="w-full h-4 rounded-lg" />
              </div>
            </div>
          ))
        ) : faculty.length === 0 ? (
          <div className="col-span-full py-24 text-center">
            <div className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center mx-auto mb-6">
               <Search className="w-10 h-10 text-slate-200 dark:text-slate-800" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">No Faculty Found</h3>
            <p className="text-muted-foreground text-sm font-medium mt-2">Try searching by initials, room number, or a different part of the name.</p>
          </div>
        ) : (
          faculty.map((f, i) => (
            <motion.div
              key={f.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-card p-6 rounded-lg border border-border hover:shadow-xl dark:hover:shadow-none hover:border-primary/20 dark:hover:border-primary/20 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="w-16 h-16 rounded-lg bg-background border border-slate-100 dark:border-border overflow-hidden relative shadow-sm group-hover:scale-105 transition-transform shrink-0">
                    {f.photo_url ? (
                      <img src={f.photo_url} alt={f.short_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary font-semibold text-xl uppercase">
                        {f.short_name.substring(0, 2)}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div className="px-3 py-1 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-[10px] font-semibold uppercase tracking-wider border border-primary/20 dark:border-primary/20">
                      {f.short_name}
                    </div>
                    {f.office_room && (
                      <div className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-md text-[10px] font-bold border border-amber-500/20">
                        <DoorClosed className="w-3 h-3" />
                        <span>Room {f.office_room}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="min-h-[3.5rem]">
                  <h3 className="text-lg font-semibold text-foreground leading-tight group-hover:text-primary dark:group-hover:text-primary transition-colors">
                    {f.full_name || 'N/A'}
                  </h3>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-1">
                    {f.designation_name || 'Faculty Member'}
                  </p>
                  {f.department_name && (
                    <p className="text-[11px] text-muted-foreground/80 font-medium truncate mt-0.5" title={f.department_name}>
                      {f.department_name}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-5 border-t border-border space-y-2.5">
                <div className="flex items-center gap-3 text-muted-foreground">
                   <Mail className="w-4 h-4 shrink-0" />
                   <span className="text-xs font-bold truncate">{f.email || 'No email registered'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                   <Phone className="w-4 h-4 shrink-0" />
                   <span className="text-xs font-bold">{f.phone || 'No phone registered'}</span>
                </div>
                <div className="flex items-center gap-3 text-muted-foreground">
                   <Building2 className={`w-4 h-4 shrink-0 ${f.office_room ? 'text-amber-500' : 'text-slate-400'}`} />
                   <span className={`text-xs font-bold ${f.office_room ? 'text-foreground font-extrabold' : 'text-muted-foreground'}`}>
                     {f.office_room ? `Room ${f.office_room}` : 'No office assigned'}
                   </span>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Pagination Controls */}
      {!loading && faculty.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-8 pb-12">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-3 bg-card border border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md dark:hover:shadow-none disabled:opacity-30 transition-all cursor-pointer"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <div className="px-6 py-3 bg-card border border-border rounded-lg text-xs font-semibold text-foreground shadow-sm">
            Page {page + 1}
          </div>

          <button
            onClick={() => setPage(p => p + 1)}
            disabled={faculty.length < pageSize}
            className="p-3 bg-card border border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md dark:hover:shadow-none disabled:opacity-30 transition-all cursor-pointer"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* New Faculty Members Detected Modal (Displayed ONLY if new faculty exist) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between bg-accent/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">New Faculty Members Detected</h3>
                  <p className="text-xs text-muted-foreground font-medium">
                    Found {newFaculties.length} newly listed {newFaculties.length === 1 ? 'member' : 'members'} during the latest synchronization.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowNewModal(false)}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 divide-y divide-border">
              {newFaculties.map((nf, idx) => (
                <div key={idx} className={`flex items-start gap-4 ${idx > 0 ? 'pt-4' : ''}`}>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0 border border-primary/20 overflow-hidden">
                    {nf.photo_url ? (
                      <img src={nf.photo_url} alt={nf.full_name} className="w-full h-full object-cover" />
                    ) : (
                      nf.short_name?.substring(0, 3) || 'FAC'
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-sm font-bold text-foreground truncate">{nf.full_name}</h4>
                      {nf.short_name && (
                        <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full border border-primary/20 shrink-0">
                          {nf.short_name}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground font-medium mt-0.5">
                      {nf.designation || 'Faculty Member'} {nf.department ? `• ${nf.department}` : ''}
                    </p>
                    <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                      {nf.office_room && (
                        <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
                          <DoorClosed className="w-3.5 h-3.5" /> Room {nf.office_room}
                        </span>
                      )}
                      {nf.email && (
                        <span className="flex items-center gap-1 font-medium truncate max-w-[220px]">
                          <Mail className="w-3.5 h-3.5" /> {nf.email}
                        </span>
                      )}
                      <span className="px-1.5 py-0.5 bg-accent text-accent-foreground text-[9px] font-bold rounded uppercase">
                        Source: {nf.source || 'Website'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-border bg-accent/20 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                Records have been refreshed in the Central Directory.
              </span>
              <button
                onClick={() => setShowNewModal(false)}
                className="px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-xl hover:bg-primary/90 transition-colors cursor-pointer"
              >
                Acknowledge & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
