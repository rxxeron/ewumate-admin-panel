import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import React, { useEffect, useState } from 'react';
import { useConfirm } from '../components/ConfirmProvider';
import { supabase } from '../lib/supabase';
import { Calendar as CalendarIcon, Plus, Trash2, Loader2, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { CalendarEvent } from '../types';
import { cn } from '../lib/utils';

const eventSchema = z.object({
  date: z.string().min(1, 'Date is required'),
  title: z.string().min(3, 'Title must be at least 3 characters').max(200, 'Title too long'),
  type: z.string().min(1, 'Event type is required'),
  targetTrack: z.string().min(1, 'Target track is required')
});
type EventFormValues = z.infer<typeof eventSchema>;

export function CalendarEditor() {
  const confirmAction = useConfirm();
  const [tracks, setTracks] = useState<any[]>([]);
  const [selectedTrack, setSelectedTrack] = useState<string>('');
  const [activeSemester, setActiveSemester] = useState<string>('');
  const [tableName, setTableName] = useState<string>('');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState({ date: '', title: '', type: 'Holiday', targetTrack: '' });
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fetchActiveSemester = async () => {
    try {
      const { data, error } = await supabase.from('active_semester').select('*');
      if (error) throw error;
      
      if (data && data.length > 0) {
        setTracks(data);
        if (!selectedTrack) {
          const defaultTrack = data.find(s => s.track === 'tri_semester') || data[0];
          setSelectedTrack(defaultTrack.track);
          updateSemesterAndTable(defaultTrack);
        } else {
          const current = data.find(s => s.track === selectedTrack);
          if (current) updateSemesterAndTable(current);
        }
      } else {
        setErrorMsg('No active semester entries found in database.');
      }
    } catch (err: any) {
      console.error('Error fetching active semester:', err);
      setErrorMsg('Failed to fetch active semester context.');
    }
  };

  const updateSemesterAndTable = (trackData: any) => {
    const semesterCode = trackData.current_semester_code;
    setActiveSemester(semesterCode);
    let table = `calendar_${semesterCode.replace(/\s+/g, '').toLowerCase()}`;
    if (trackData.track === 'bi_semester') {
      table += '_phrm_llb';
    }
    setTableName(table);
  };

  const fetchEvents = async (table: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .order('event_date', { ascending: true });
        
      if (error) {
        if (error.code === '42P01') {
          setEvents([]);
          setErrorMsg(`Table ${table} does not exist yet. Please upload a calendar first.`);
        } else {
          throw error;
        }
      } else {
        setEvents(data || []);
        setErrorMsg('');
      }
    } catch (err: any) {
      console.error('Error fetching events:', err);
      setErrorMsg(err.message || 'Error fetching calendar events.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSemester();
  }, [selectedTrack]);

  useEffect(() => {
    if (tableName) {
      fetchEvents(tableName);
    } else {
      setLoading(false);
    }
  }, [tableName]);

    const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<EventFormValues>({
    resolver: zodResolver(eventSchema),
    defaultValues: { type: 'Holiday', targetTrack: '' }
  });

  const onSubmit = async (data: EventFormValues) => {
    if (!tableName) return;
    setSaving(true);
    setErrorMsg('');
    try {
      const targetTrack = data.targetTrack || selectedTrack;
      const payload = {
        event_date: new Date(data.date).toISOString().split('T')[0],
        title: data.title,
        type: data.type,
        target_track: targetTrack === 'both' ? 'both' : targetTrack
      };

      const cleanSem = (activeSemester || '').replace(/\s+/g, '').toLowerCase();
      const triTable = `calendar_${cleanSem}`;
      const biTable = `calendar_${cleanSem}_phrm_llb`;

      if (targetTrack === 'both') {
        await Promise.all([
          supabase.from(triTable).insert([{ ...payload, target_track: 'tri_semester' }]),
          supabase.from(biTable).insert([{ ...payload, target_track: 'bi_semester' }])
        ]);
        
        fetchEvents(tableName);
      } else {
        const targetTable = targetTrack === 'bi_semester' ? biTable : triTable;

        const { data: resData, error } = await supabase.from(targetTable).insert([payload]).select().single();
        if (error) throw error;
        
        if (targetTable === tableName) {
          setEvents(prev => {
            const updated = [...prev, resData];
            return updated.sort((a, b) => new Date(a.event_date).getTime() - new Date(b.event_date).getTime());
          });
        }
      }

      setShowAddForm(false);
      reset();
      toast.success('Event added successfully');
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Failed to add event');
    } finally {
      setSaving(false);
    }
  };const handleDelete = async (id: string) => {
    if (!id || !await confirmAction('Are you sure you want to delete this event?')) return;
    
    const previousEvents = [...events];
    setEvents(prev => prev.filter(evt => evt.id !== id));
    
    try {
      const { error } = await supabase.from(tableName).delete().eq('id', id);
      if (error) throw error;
      toast.success('Event deleted');
    } catch (err: any) {
      console.error(err);
      setEvents(previousEvents);
      toast.error('Failed to delete: ' + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-4">
             <div className="p-3 bg-primary rounded-lg text-white shadow-lg shadow-sm dark:shadow-none">
               <CalendarIcon className="w-6 h-6" />
             </div>
             Calendar Manager
          </h2>
          <p className="text-muted-foreground text-xs font-semibold uppercase  mt-2 ml-1">
            Global Academic Timeline for <span className="text-primary dark:text-primary">{activeSemester || '...'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {tracks.length > 1 && (
            <div className="flex bg-muted p-1.5 rounded-lg border border-slate-200 dark:border-border shadow-inner w-full sm:w-auto">
              {tracks.map(t => (
                <button
                  key={t.track}
                  onClick={() => setSelectedTrack(t.track)}
                  className={cn(
                    "flex-1 sm:flex-none px-4 py-2 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all",
                    selectedTrack === t.track 
                      ? 'bg-card text-primary dark:text-primary shadow-md' 
                      : 'text-muted-foreground hover:text-slate-600 dark:hover:text-slate-300'
                  )}
                >
                  {t.track.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}
          <button
            onClick={() => setShowAddForm(true)}
            disabled={!tableName || !!errorMsg}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3.5 bg-slate-900 dark:bg-primary text-white rounded-lg shadow-xl shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-primary/90 disabled:opacity-50 transition-all text-xs font-semibold uppercase tracking-wider"
          >
            <Plus className="w-4 h-4" />
            Inject Event
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 p-6 rounded-xl border border-rose-100 dark:border-rose-500/20 font-bold text-sm shadow-sm flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shrink-0" />
          {errorMsg}
        </div>
      )}

      <AnimatePresence>
        {showAddForm && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: -20 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -20 }}
            className="bg-card p-6 sm:p-8 rounded-xl sm:rounded-[2.5rem] shadow-xl border border-indigo-50 dark:border-border relative overflow-hidden"
          >
            <button 
              onClick={() => setShowAddForm(false)}
              className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-accent hover:text-accent-foreground rounded-xl transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h2 className="text-xl font-semibold mb-6 text-foreground flex items-center gap-3 tracking-tight">
              <div className="p-2 bg-primary/10 dark:bg-primary/10 rounded-xl">
                <CalendarIcon className="w-5 h-5 text-primary dark:text-primary" />
              </div>
              Inject Calendar Record
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Event Date {errors.date && <span className="text-rose-500 normal-case tracking-normal">({errors.date.message})</span>}</label>
                  <input
                    type="date"
                    required
                    {...register('date')}
                    className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none transition-all font-semibold text-foreground"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Event Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Eid-ul-Fitr"
                    {...register('title')}
                    className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none transition-all font-semibold text-foreground placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Event Type</label>
                  <select
                    {...register('type')}
                    className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none transition-all font-semibold text-foreground appearance-none cursor-pointer"
                  >
                    <option value="Holiday" className="dark:bg-slate-900">Holiday</option>
                    <option value="General" className="dark:bg-slate-900">General</option>
                    <option value="Exam" className="dark:bg-slate-900">Exam / Academic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Target Track</label>
                  <select
                    {...register('targetTrack')}
                    className="w-full px-5 py-4 bg-background border border-slate-100 dark:border-border rounded-lg focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none transition-all font-semibold text-foreground appearance-none cursor-pointer"
                  >
                    <option value="tri_semester" className="dark:bg-slate-900">Tri-Semester</option>
                    <option value="bi_semester" className="dark:bg-slate-900">Bi-Semester (PHRM/LLB)</option>
                    <option value="both" className="dark:bg-slate-900">Both Tracks</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-3 px-8 py-4 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-all shadow-lg shadow-sm dark:shadow-none text-xs font-semibold uppercase tracking-wider"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Synchronizing...' : 'Save Matrix Record'}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Events Table */}
      <div className="bg-card rounded-xl sm:rounded-[2.5rem] border border-border dark:border-border shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 sm:px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                <th className="px-6 sm:px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Event & Context</th>
                <th className="hidden sm:table-cell px-8 py-5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Classification</th>
                <th className="px-6 sm:px-8 py-5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-8 py-24 text-center">
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary dark:text-primary" />
                    <p className="text-muted-foreground font-bold text-xs uppercase tracking-wider">Scanning academic timeline...</p>
                  </td>
                </tr>
              ) : events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-24 text-center">
                    <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
                       <CalendarIcon className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No Records Found</h3>
                    <p className="text-muted-foreground text-sm font-medium mt-2">The academic timeline for this quadrant is currently empty.</p>
                  </td>
                </tr>
              ) : (
                events.map((evt, i) => (
                  <motion.tr 
                    key={evt.id} 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/5 group transition-all"
                  >
                    <td className="px-6 sm:px-8 py-6">
                      <div className="text-xs sm:text-sm font-semibold text-foreground group-hover:text-primary dark:group-hover:text-primary transition-colors">
                        {formatDate(evt.event_date)}
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-6">
                      <div className="text-sm font-semibold text-foreground group-hover:tracking-tight transition-all">{evt.title}</div>
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">{evt.target_track}</div>
                    </td>
                    <td className="hidden sm:table-cell px-8 py-6">
                      <span className={cn(
                        "inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider shadow-sm border",
                        evt.type?.toLowerCase().includes('holiday') 
                          ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20' 
                          : (evt.type?.toLowerCase().includes('exam') ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20' : 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20')
                      )}>
                        {evt.type || 'General'}
                      </span>
                    </td>
                    <td className="px-6 sm:px-8 py-6 text-right">
                      <button
                        onClick={() => handleDelete(evt.id)}
                        className="p-3 text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Delete Event"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


