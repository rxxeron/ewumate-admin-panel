import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Calendar, Save, RefreshCw, AlertCircle, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cleanSemesterCode } from '../lib/academicUtils';

interface SemesterTrack {
  track: string;
  current_semester_code: string;
  next_semester_code: string;
  is_advising_open: boolean;
  is_next_semester_open: boolean;
  classes_start_date: string | null;
  classes_end_date: string | null;
  advising_start_date: string | null;
  advising_end_date: string | null;
  final_exam_start: string | null;
  final_exam_end: string | null;
  grade_submission_start: string | null;
  grade_submission_deadline?: string | null;
  semester_switch_date?: string | null;
  upcoming_classes_start_date?: string | null;
}

interface TrackFormData {
  current: string;
  next: string;
  isAdvisingOpen: boolean;
  isNextSemesterOpen: boolean;
  classesStartDate: string;
  classesEndDate: string;
  advisingStartDate: string;
  advisingEndDate: string;
  finalExamStart: string;
  finalExamEnd: string;
  gradeSubmissionStart: string;
  gradeSubmissionDeadline: string;
  semesterSwitchDate: string;
  upcomingClassesStartDate: string;
}

export function ActiveSemester() {
  const [tracks, setTracks] = useState<SemesterTrack[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});

  const [localValues, setLocalValues] = useState<Record<string, TrackFormData>>({});

  useEffect(() => {
    fetchSemesters();
  }, []);

  const fetchSemesters = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('active_semester')
      .select('*')
      .order('track', { ascending: false });
    
    if (error) {
      toast.error('Failed to load semesters: ' + error.message);
    } else if (data) {
      setTracks(data);
      const initial: Record<string, TrackFormData> = {};
      const exp: Record<string, boolean> = {};
      data.forEach(t => {
        initial[t.track] = { 
          current: t.current_semester_code || '', 
          next: t.next_semester_code || '',
          isAdvisingOpen: t.is_advising_open || false,
          isNextSemesterOpen: t.is_next_semester_open || false,
          classesStartDate: t.classes_start_date || '',
          classesEndDate: t.classes_end_date || '',
          advisingStartDate: t.advising_start_date || '',
          advisingEndDate: t.advising_end_date || '',
          finalExamStart: t.final_exam_start || '',
          finalExamEnd: t.final_exam_end || '',
          gradeSubmissionStart: t.grade_submission_start || '',
          gradeSubmissionDeadline: t.grade_submission_deadline || '',
          semesterSwitchDate: t.semester_switch_date || '',
          upcomingClassesStartDate: t.upcoming_classes_start_date || '',
        };
        exp[t.track] = true; // Expanded by default for clear milestone visibility
      });
      setLocalValues(initial);
      setExpandedDates(exp);
    }
    setLoading(false);
  };

  const updateSemester = async (track: string) => {
    const values = localValues[track];
    if (!values) return;

    setSaving(track);
    const payload = { 
      current_semester_code: cleanSemesterCode(values.current),
      next_semester_code: cleanSemesterCode(values.next),
      is_advising_open: values.isAdvisingOpen,
      is_next_semester_open: values.isNextSemesterOpen,
      classes_start_date: values.classesStartDate || null,
      classes_end_date: values.classesEndDate || null,
      advising_start_date: values.advisingStartDate || null,
      advising_end_date: values.advisingEndDate || null,
      final_exam_start: values.finalExamStart || null,
      final_exam_end: values.finalExamEnd || null,
      grade_submission_start: values.gradeSubmissionStart || null,
      grade_submission_deadline: values.gradeSubmissionDeadline || null,
      semester_switch_date: values.semesterSwitchDate || null,
      upcoming_classes_start_date: values.upcomingClassesStartDate || null,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('active_semester')
      .update(payload)
      .eq('track', track);

    if (error) {
      toast.error(`Failed to update ${track}: ` + error.message);
    } else {
      toast.success(`${track} milestone dates & config synchronized!`);
      fetchSemesters();
    }
    setSaving(null);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-64 space-y-4">
      <RefreshCw className="w-8 h-8 text-primary animate-spin" />
      <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider animate-pulse">Synchronizing semester tracks...</p>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="bg-slate-900 dark:bg-indigo-950 rounded-lg sm:rounded-[2.5rem] p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden group transition-colors duration-500">
        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:rotate-12 transition-transform duration-700">
           <Calendar className="w-48 h-48" />
        </div>
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/10 backdrop-blur-md rounded-lg border border-border">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight">Active Semester & Milestone Engine</h2>
          </div>
          <p className="text-indigo-100/70 max-w-xl text-sm font-medium leading-relaxed">
            Configure current and upcoming semester codes, advising toggles, and critical academic countdown dates. 
            These dates directly power the student mobile app routine countdowns, advising period locks, and final exam alerts.
          </p>
        </div>
      </div>

      {tracks.length === 0 ? (
        <div className="bg-primary/10 dark:bg-primary/10 border border-primary/20 dark:border-primary/20 p-8 rounded-lg flex items-start gap-5 shadow-sm">
          <div className="p-3 bg-card rounded-lg shadow-sm border border-border">
             <AlertCircle className="w-6 h-6 text-primary shrink-0" />
          </div>
          <div>
            <h3 className="text-amber-900 dark:text-primary font-semibold tracking-tight">No Tracks Configured</h3>
            <p className="text-primary/70 dark:text-primary/70 text-sm font-medium mt-1">
              Navigate to the <Link to="/academic-data" className="font-semibold text-amber-900 dark:text-primary underline">Global Data</Link> quadrant to initialize your academic tracks.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {tracks.map((t, i) => (
            <motion.div 
              key={t.track} 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-card rounded-lg shadow-sm border border-border p-6 sm:p-8 hover:shadow-xl dark:hover:shadow-black/20 hover:border-primary/20 dark:hover:border-primary/20 transition-all group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-6">
                  <span className="px-4 py-1.5 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-full text-[10px] font-semibold uppercase tracking-wider border border-primary/20 dark:border-primary/20">
                    {t.track.replace('_', ' ')}
                  </span>
                  <div className="p-2 bg-muted rounded-xl text-slate-400 dark:text-slate-600 group-hover:text-primary transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                </div>
                
                <div className="space-y-6">
                  {/* Semester Codes */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Current Semester</label>
                      <input
                        type="text"
                        value={localValues[t.track]?.current || ''}
                        onChange={(e) => setLocalValues(prev => ({
                          ...prev,
                          [t.track]: { ...prev[t.track], current: e.target.value }
                        }))}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-all font-semibold text-foreground placeholder:text-muted-foreground text-sm"
                        placeholder="e.g. Summer 2026"
                      />
                      <span className="text-[9px] text-muted-foreground mt-1 ml-1 block font-mono">
                        Table: courses_{cleanSemesterCode(localValues[t.track]?.current || '')}
                      </span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 ml-1">Next Semester</label>
                      <input
                        type="text"
                        value={localValues[t.track]?.next || ''}
                        onChange={(e) => setLocalValues(prev => ({
                          ...prev,
                          [t.track]: { ...prev[t.track], next: e.target.value }
                        }))}
                        className="w-full px-4 py-3 bg-background border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-primary outline-none transition-all font-semibold text-foreground placeholder:text-muted-foreground text-sm"
                        placeholder="e.g. Fall 2026"
                      />
                      <span className="text-[9px] text-muted-foreground mt-1 ml-1 block font-mono">
                        Table: courses_{cleanSemesterCode(localValues[t.track]?.next || '')}
                      </span>
                    </div>
                  </div>

                  {/* Advising & Next Semester Toggles */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                     <div 
                      onClick={() => setLocalValues(prev => ({
                        ...prev,
                        [t.track]: { ...prev[t.track], isAdvisingOpen: !prev[t.track].isAdvisingOpen }
                      }))}
                      className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        localValues[t.track]?.isAdvisingOpen 
                          ? 'bg-primary/10 border-primary/20' 
                          : 'bg-background border-border'
                      }`}
                     >
                        <div>
                          <div className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                            localValues[t.track]?.isAdvisingOpen ? 'text-primary' : 'text-muted-foreground'
                          }`}>Advising Assistant</div>
                          <div className="text-xs font-bold text-foreground">
                            {localValues[t.track]?.isAdvisingOpen ? 'OPEN TO STUDENTS' : 'LOCKED / CLOSED'}
                          </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${
                          localValues[t.track]?.isAdvisingOpen ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                        }`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                            localValues[t.track]?.isAdvisingOpen ? 'left-6' : 'left-1'
                          }`} />
                        </div>
                     </div>

                     <div 
                      onClick={() => setLocalValues(prev => ({
                        ...prev,
                        [t.track]: { ...prev[t.track], isNextSemesterOpen: !prev[t.track].isNextSemesterOpen }
                      }))}
                      className={`p-4 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                        localValues[t.track]?.isNextSemesterOpen 
                          ? 'bg-primary/10 border-primary/20' 
                          : 'bg-background border-border'
                      }`}
                     >
                        <div>
                          <div className={`text-[10px] font-semibold uppercase tracking-wider mb-0.5 ${
                            localValues[t.track]?.isNextSemesterOpen ? 'text-primary' : 'text-muted-foreground'
                          }`}>Next Semester Routine</div>
                          <div className="text-xs font-bold text-foreground">
                            {localValues[t.track]?.isNextSemesterOpen ? 'VISIBLE IN APP' : 'HIDDEN FROM APP'}
                          </div>
                        </div>
                        <div className={`w-10 h-5 rounded-full relative transition-colors ${
                          localValues[t.track]?.isNextSemesterOpen ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-700'
                        }`}>
                          <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${
                            localValues[t.track]?.isNextSemesterOpen ? 'left-6' : 'left-1'
                          }`} />
                        </div>
                     </div>
                  </div>

                  {/* Milestone Dates Section */}
                  <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
                    <button
                      type="button"
                      onClick={() => setExpandedDates(prev => ({ ...prev, [t.track]: !prev[t.track] }))}
                      className="w-full px-4 py-3 bg-muted/40 hover:bg-muted/70 flex items-center justify-between text-xs font-semibold text-foreground transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-primary" />
                        <span>Academic Milestone Dates (Student App Countdowns)</span>
                      </div>
                      {expandedDates[t.track] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <AnimatePresence>
                      {expandedDates[t.track] && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="p-4 space-y-4 text-xs"
                        >
                          {/* Classes Range */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Classes Start Date</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.classesStartDate || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], classesStartDate: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Classes End Date</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.classesEndDate || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], classesEndDate: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          </div>

                          {/* Advising Range */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Advising Window Start</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.advisingStartDate || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], advisingStartDate: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Advising Window End</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.advisingEndDate || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], advisingEndDate: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          </div>

                          {/* Final Exams Range */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Final Exam Start</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.finalExamStart || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], finalExamStart: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Final Exam End</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.finalExamEnd || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], finalExamEnd: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          </div>

                          {/* Grade Submission & Upcoming */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Grade Submission Deadline</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.gradeSubmissionDeadline || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], gradeSubmissionDeadline: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-muted-foreground uppercase mb-1">Upcoming Term Classes Start</label>
                              <input
                                type="date"
                                value={localValues[t.track]?.upcomingClassesStartDate || ''}
                                onChange={(e) => setLocalValues(prev => ({
                                  ...prev,
                                  [t.track]: { ...prev[t.track], upcomingClassesStartDate: e.target.value }
                                }))}
                                className="w-full px-3 py-2 bg-background border border-border rounded-md text-foreground text-xs focus:ring-1 focus:ring-primary outline-none"
                              />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              
              <button
                onClick={() => updateSemester(t.track)}
                disabled={saving === t.track}
                className="w-full mt-6 flex items-center justify-center gap-3 bg-primary text-white py-3.5 rounded-lg font-semibold text-xs uppercase hover:bg-primary/90 disabled:opacity-50 transition-all shadow-md"
              >
                {saving === t.track ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving === t.track ? 'Synchronizing Track...' : 'Sync Configuration & Milestone Dates'}
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
