import { useDatabaseOptions } from '../hooks/useDatabaseOptions';
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, RefreshCw, Users, CheckCircle2, Clipboard, 
  CalendarClock, AlertTriangle, Clock, Edit, Save, 
  X, Plus, Trash2, Shield, Activity, Zap, GraduationCap, BookOpen, BellRing, Smartphone
} from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import type { Profile, Enrollment, CompletedCourse, Task, CourseMark, UserSemesterState, LocalNotificationState } from '../types';
import { CardSkeleton, Skeleton } from '../components/Skeleton';
import { cn } from '../lib/utils';

export function UserDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  
  const [user, setUser] = useState<Profile | null>(null);
  const [completedCourses, setCompletedCourses] = useState<CompletedCourse[]>([]);
  const [currentEnrollments, setCurrentEnrollments] = useState<Enrollment[]>([]);
  const [nextEnrollments, setNextEnrollments] = useState<Enrollment[]>([]);
  const [activeSemesterInfo, setActiveSemesterInfo] = useState<{ current: string | null; next: string | null }>({ current: null, next: null });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [marks, setMarks] = useState<CourseMark[]>([]);
  const [semesterState, setSemesterState] = useState<UserSemesterState | null>(null);
  const [localNotifStates, setLocalNotifStates] = useState<LocalNotificationState[]>([]);
  const [userPushNotifications, setUserPushNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  
  const [isAddingCourse, setIsAddingCourse] = useState(false);
  const [courseForm, setCourseForm] = useState<Partial<CompletedCourse>>({});
  const [availablePrograms, setAvailablePrograms] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchUser(id);
      fetchPrograms();
    }
  }, [id]);

  async function fetchPrograms() {
    try {
      const { data } = await supabase.from('programs').select('program_code, name, department_name, track, total_degree_credits');
      if (data) setAvailablePrograms(data);
    } catch (e) {
      console.error('Failed to fetch programs:', e);
    }
  }

  const startAddingCourse = () => {
    setCourseForm({
      semester_code: '',
      course_code: '',
      grade: 'A',
      credits: 3.0,
      user_id: id
    });
    setIsAddingCourse(true);
  };

  const handleAddCourse = async () => {
    if (!id || !courseForm.course_code || !courseForm.semester_code) return;
    setSaving(true);
    const normalizedForm = { 
      ...courseForm, 
      course_code: courseForm.course_code?.toUpperCase().replace(/\s+/g, ''),
      user_id: id 
    };

    try {
      const { error } = await supabase
        .from('completed_courses')
        .insert([normalizedForm]);
      
      if (error) throw error;
      toast.success('Course added');
      setIsAddingCourse(false);
      handleSyncData();
    } catch (err: any) {
      toast.error('Failed to add course: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCourse = async (courseId: string) => {
    if (!confirm('Are you sure you want to delete this course history record?')) return;
    try {
      const { error } = await supabase
        .from('completed_courses')
        .delete()
        .eq('id', courseId);
      
      if (error) throw error;
      toast.success('Course record deleted');
      handleSyncData();
    } catch (err: any) {
      toast.error('Delete failed: ' + err.message);
    }
  };

  const handleDeleteEnrollment = async (enrollmentId: string) => {
    if (!confirm('Are you sure you want to remove this course from current enrollments? This will affect the user\'s schedule.')) return;
    try {
      const { error } = await supabase
        .from('enrollments')
        .delete()
        .eq('id', enrollmentId);
      
      if (error) throw error;
      toast.success('Enrollment removed');
      fetchUser(id!);
    } catch (err: any) {
      toast.error('Removal failed: ' + err.message);
    }
  };

  const startEditing = () => {
    if (user) {
      setEditForm({
        full_name: user.full_name,
        student_id: user.student_id,
        program_code: user.program_code,
        program_name: user.program_name,
        department_name: user.department_name,
        cgpa: user.cgpa,
        total_credits_earned: user.total_credits_earned,
        track: user.track,
        onboarding_status: user.onboarding_status
      });
      setIsEditingProfile(true);
    }
  };

  const handleUpdateProfile = async () => {
    if (!id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(editForm)
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Profile updated successfully');
      setIsEditingProfile(false);
      fetchUser(id);
    } catch (err: any) {
      toast.error('Update failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!id || !user) return;
    
    const confirmText = `DELETE ${user.full_name || user.student_id}`;
    const input = prompt(`DANGER: This will permanently delete the user's account and all data. This action cannot be undone.\n\nTo confirm, please type: ${confirmText}`);
    
    if (input !== confirmText) {
      if (input !== null) toast.error('Confirmation text mismatch');
      return;
    }
    
    setSaving(true);
    const toastId = toast.loading('Purging user data...');
    try {
      // Secure Cloud-Side Purge (invokes admin-purge-user Edge Function securely, completely shielding superuser keys)
      const { error: authError } = await supabase.functions.invoke('admin-purge-user', {
        body: { targetUserId: id }
      });
      if (authError) throw authError;

      // Delete profile (though cascade should handle it)
      await supabase.from('profiles').delete().eq('id', id);

      toast.success('User has been completely removed', { id: toastId });
      navigate('/users');
    } catch (err: any) {
      toast.error('Deletion failed: ' + err.message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  async function fetchUser(userId: string) {
    setLoading(true);
    
    try {
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError) throw userError;
      if (userData) setUser(userData as Profile);

      const track = userData.track || 'tri_semester';
      const { data: activeSem } = await supabase
        .from('active_semester')
        .select('current_semester_code, next_semester_code')
        .eq('track', track)
        .maybeSingle();

      const semesterCode = activeSem?.current_semester_code;
      const nextSemesterCode = activeSem?.next_semester_code;
      setActiveSemesterInfo({ current: semesterCode || null, next: nextSemesterCode || null });

      // 3. Fetch Semester State (Schedule Cache)
      if (semesterCode) {
        try {
          const { data: stateData } = await supabase
            .from('user_semester_states')
            .select('*')
            .eq('user_id', userId)
            .eq('semester_code', semesterCode)
            .maybeSingle();
          
          if (stateData) setSemesterState(stateData as UserSemesterState);
        } catch (e) {
          console.error('Failed to fetch semester state:', e);
        }
      }

      // 4. Fetch Enrollments for both current and next
      try {
        const { data: enrollmentsData } = await supabase
          .from('enrollments')
          .select('*')
          .eq('user_id', userId)
          .in('semester_code', [semesterCode, nextSemesterCode].filter(Boolean));

        if (enrollmentsData) {
          const current = enrollmentsData.filter((e: any) => e.semester_code === semesterCode);
          const next = enrollmentsData.filter((e: any) => e.semester_code === nextSemesterCode);

          const processEnrollments = async (list: any[], sem: string) => {
            const sectionIds = list.map((e: any) => e.section_id).filter(Boolean);
            if (sectionIds.length > 0) {
              const cleanSem = sem.replace(/\s+/g, '').replace(/_/g, '').toLowerCase();
              const courseTable = `courses_${cleanSem}`;
              const sectionsMap: Record<string, any> = {};
              const { data: semCourses } = await supabase.from(courseTable).select('id, section_number, course_name').in('id', sectionIds);
              if (semCourses) semCourses.forEach((s: any) => sectionsMap[s.id] = s);
              list.forEach((e: any) => {
                if (e.section_id && sectionsMap[e.section_id]) e._sectionDetails = sectionsMap[e.section_id];
              });
            }
            return list;
          };

          if (semesterCode) setCurrentEnrollments(await processEnrollments(current, semesterCode));
          if (nextSemesterCode) setNextEnrollments(await processEnrollments(next, nextSemesterCode));
        }
      } catch (e) {
        console.error('Failed to fetch enrollments:', e);
      }

      // 5. Fetch Other Data
      try {
        const { data: coursesData } = await supabase.from('completed_courses').select('*').eq('user_id', userId).order('semester_code', { ascending: false });
        if (coursesData) setCompletedCourses(coursesData as CompletedCourse[]);
      } catch (e) {
        console.error('Failed to fetch completed courses:', e);
      }

      try {
        const { data: tasksData } = await supabase.from('tasks').select('*').eq('user_id', userId).order('due_date', { ascending: false }).limit(50);
        if (tasksData) setTasks(tasksData as Task[]);
      } catch (e) {
        console.error('Failed to fetch tasks:', e);
      }

      try {
        const { data: marksData } = await supabase.from('semester_course_marks').select('*').eq('user_id', userId);
        if (marksData && semesterCode) {
          const cleanSem = semesterCode.replace(/\s+/g, '').replace(/_/g, '').toLowerCase();
          const courseTable = `courses_${cleanSem}`;
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          const uuidCodes = marksData.map((m: CourseMark) => m.course_code).filter((c: any) => c && uuidRegex.test(c));
          
          if (uuidCodes.length > 0) {
            const { data: semCourses } = await supabase.from(courseTable).select('id, course_code').in('id', uuidCodes);
            if (semCourses) {
              const courseMap: Record<string, string> = {};
              semCourses.forEach((s: any) => courseMap[s.id] = s.course_code);
              marksData.forEach((m: CourseMark) => {
                if (courseMap[m.course_code]) {
                  m.course_code = courseMap[m.course_code];
                }
              });
            }
          }
          
          const filteredMarks = marksData.filter((m: CourseMark) => m.course_code && m.course_code.length <= 15 && !m.course_code.includes('-'));
          setMarks(filteredMarks as CourseMark[]);
        }
      } catch (e) {
        console.error('Failed to fetch marks:', e);
      }

      // 6. Fetch Local Notification States & Device Deployments
      try {
        const { data: localData } = await supabase
          .from('local_notification_states')
          .select('*')
          .eq('user_id', userId)
          .order('last_scheduled_at', { ascending: false });
        if (localData) setLocalNotifStates(localData as LocalNotificationState[]);
      } catch (e) {
        console.error('Failed to fetch local notification states:', e);
      }

      // 7. Fetch Push Notification History for this user
      try {
        const { data: pushData } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);
        if (pushData) setUserPushNotifications(pushData);
      } catch (e) {
        console.error('Failed to fetch user push notifications:', e);
      }
    } catch (err: any) {
      console.error('Critical fetch error:', err);
    }
    setLoading(false);
  }

  const handleSyncData = async () => {
    if (!id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-academic-stats', {
        body: { user_id: id }
      });
      if (error) throw error;
      toast.success(`Sync complete: CGPA ${data?.cgpa ?? '?'}`, { duration: 4000 });
      fetchUser(id);
    } catch (err: any) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleRebuildSchedule = async () => {
    if (!id) return;
    setRebuilding(true);
    const toastId = toast.loading('Rebuilding schedule cache...');
    try {
      const { error } = await supabase.functions.invoke('sync-schedule', {
        body: { user_id: id }
      });
      if (error) throw error;
      toast.success('Schedule rebuilt successfully!', { id: toastId });
      fetchUser(id);
    } catch (err: any) {
      toast.error('Rebuild failed: ' + err.message, { id: toastId });
    } finally {
      setRebuilding(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Skeleton className="w-12 h-12 rounded-2xl" />
            <div className="space-y-2">
              <Skeleton className="w-48 h-8" />
              <Skeleton className="w-32 h-4" />
            </div>
          </div>
          <div className="flex gap-2">
            <Skeleton className="w-24 h-10 rounded-xl" />
            <Skeleton className="w-32 h-10 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    );
  }

  if (!user) return <div className='text-center py-24'><h3 className='text-lg font-black text-slate-900 dark:text-white'>User not found</h3></div>;

  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  return (
    <div className='space-y-8 animate-in fade-in duration-700'>
      {/* Header */}
      <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-6'>
        <div className='flex items-center gap-5'>
          <button 
            onClick={() => navigate('/users')} 
            className='p-3 bg-card border border-border rounded-2xl text-foreground hover:bg-muted transition-all'
          >
            <ArrowLeft className='h-5 w-5' />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center font-black text-2xl text-primary shadow-inner border border-primary/20">
               {user.full_name?.substring(0, 1)}
            </div>
            <div>
              <h1 className='text-3xl font-black text-foreground tracking-tight'>{user.full_name || 'Unknown User'}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className='text-[10px] font-black bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full uppercase tracking-widest'>{user.student_id || 'N/A'}</span>
                <span className='text-[10px] font-black bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full uppercase tracking-widest'>{user.track?.replace('_', ' ') || 'Tri-Semester'}</span>
                {(user as any).app_version && (
                  <span className='text-[10px] font-black bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full uppercase tracking-widest flex items-center gap-1'>
                    <Zap className="w-3 h-3" /> {/^\d/.test((user as any).app_version) ? `v${(user as any).app_version}` : (user as any).app_version}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className='flex flex-wrap sm:flex-nowrap gap-2 w-full md:w-auto'>
          <button 
            onClick={startEditing} 
            className='flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-card border border-border text-foreground rounded-2xl hover:bg-muted text-[10px] font-black uppercase tracking-widest shadow-sm transition-all'
          >
            <Edit className='h-4 w-4' />
            Edit Profile
          </button>
          <button 
            onClick={handleDeleteUser} 
            className='flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-card border border-rose-500/20 text-rose-500 rounded-2xl hover:bg-rose-500/10 text-[10px] font-black uppercase tracking-widest shadow-sm transition-all'
          >
            <Trash2 className='h-4 w-4' />
            Delete Account
          </button>
          <button 
            onClick={handleSyncData} 
            disabled={syncing} 
            className='flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-primary text-primary-foreground rounded-2xl hover:opacity-90 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20 transition-all'
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing...' : 'Sync Portal'}
          </button>
          <button 
            onClick={handleRebuildSchedule} 
            disabled={rebuilding} 
            className='flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 transition-all'
          >
            <CalendarClock className={`h-4 w-4 ${rebuilding ? 'animate-spin' : ''}`} />
            {rebuilding ? 'Rebuilding...' : 'Fix Schedule'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs - Scrollable on Mobile */}
      <div className='w-full overflow-x-auto hide-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0'>
        <div className='bg-card/70 backdrop-blur-md p-1.5 rounded-[1.5rem] border border-border inline-flex gap-1 min-w-full sm:min-w-0'>
          {['overview', 'enrollments', 'schedule', 'history', 'tasks', 'marks', 'notifications'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={cn(
                'px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap',
                activeTab === tab 
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <motion.div 
        key={activeTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className='mt-2'
      >
        {activeTab === 'overview' && (
          <div className='grid grid-cols-1 lg:grid-cols-3 gap-8'>
            <div className="lg:col-span-2 space-y-8">
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <motion.div whileHover={{ y: -4 }} className='bg-card p-8 rounded-[2rem] shadow-sm border border-border flex flex-col'>
                  <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-primary/10 rounded-2xl">
                        <GraduationCap className="w-6 h-6 text-primary" />
                      </div>
                      <h3 className='text-lg font-black text-foreground tracking-tight'>Academic Progress</h3>
                    </div>
                    {(() => {
                      const program = availablePrograms.find(p => p.program_code === user.program_code);
                      const targetCredits = program?.total_degree_credits || 124;
                      const progress = Math.round(((user.total_credits_earned || 0) / targetCredits) * 100);
                      
                      return (
                        <>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-full uppercase tracking-widest">
                                {progress}% Complete
                            </span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                  
                  {(() => {
                    const program = availablePrograms.find(p => p.program_code === user.program_code);
                    const targetCredits = program?.total_degree_credits || 124;
                    const progress = Math.min(((user.total_credits_earned || 0) / targetCredits) * 100, 100);
                    
                    return (
                      <div className="mb-8">
                        <div className="flex justify-between items-end mb-2">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Path to Graduation</span>
                            <span className="text-xs font-black text-foreground">{user.total_credits_earned || 0} / {targetCredits} Credits</span>
                        </div>
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden border border-border">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${progress}%` }}
                              transition={{ duration: 1.5, ease: "easeOut" }}
                              className="h-full bg-primary rounded-full shadow-lg shadow-primary/20"
                            />
                        </div>
                      </div>
                    );
                  })()}

                  <dl className='grid grid-cols-2 gap-6 mt-auto'>
                    <div>
                      <dt className='text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1'>Selected Program</dt>
                      <dd className='text-xs font-bold text-foreground line-clamp-1'>{user.program_name || user.program_code || 'N/A'}</dd>
                    </div>
                    <div className="text-right">
                      <dt className='text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em] mb-1'>Current CGPA</dt>
                      <dd className='text-2xl font-black text-primary'>{user.cgpa?.toFixed(2) || '0.00'}</dd>
                    </div>
                  </dl>
                </motion.div>
                
                <motion.div whileHover={{ y: -4 }} className='bg-card p-8 rounded-[2rem] shadow-sm border border-border'>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="p-3 bg-emerald-500/10 rounded-2xl">
                      <Activity className="w-6 h-6 text-emerald-500" />
                    </div>
                    <h3 className='text-lg font-black text-foreground tracking-tight'>System Diagnostics</h3>
                  </div>
                  <div className='space-y-5'>
                    <div className='flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border'>
                      <span className='text-[10px] font-black text-muted-foreground uppercase tracking-widest'>Onboarding</span>
                      <span className={cn(
                        'text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest shadow-sm',
                        user.onboarding_status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                      )}>
                        {user.onboarding_status?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </div>
                    <div className='flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border'>
                      <span className='text-[10px] font-black text-muted-foreground uppercase tracking-widest'>Engagement</span>
                      <span className='text-sm font-black text-foreground'>{user.app_open_count || 0} Sessions</span>
                    </div>
                    <div className='flex items-center justify-between p-3 bg-muted/30 rounded-2xl border border-border'>
                      <span className='text-[10px] font-black text-muted-foreground uppercase tracking-widest'>Last Sync</span>
                      <span className='text-xs font-bold text-foreground'>{user.last_active_at ? new Date(user.last_active_at).toLocaleDateString() : 'Never'}</span>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Quick Actions */}
              <div className="bg-slate-900 rounded-[2rem] p-8 shadow-xl text-white overflow-hidden relative group">
                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                   <Zap className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                  <h3 className='text-xl font-black tracking-tight mb-2'>Fast Recovery</h3>
                  <p className='text-indigo-200/70 text-xs font-medium mb-6 max-w-md'>If the user is reporting missing schedules or incorrect CGPA, use these force-recovery tools to rebuild their data state.</p>
                  <div className="flex flex-wrap gap-4">
                     <button onClick={handleSyncData} className="px-6 py-3 bg-white text-slate-900 dark:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-50 transition-all flex items-center gap-2">
                        <RefreshCw className="w-3 h-3" /> Force Data Sync
                     </button>
                     <button onClick={handleRebuildSchedule} className="px-6 py-3 bg-indigo-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-400 transition-all flex items-center gap-2">
                        <CalendarClock className="w-3 h-3" /> Regenerate Grid
                     </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Sidebar / Timeline */}
            <div className="space-y-8">
              <div className='bg-card p-8 rounded-[2rem] shadow-sm border border-border'>
                <h3 className='text-lg font-black text-foreground tracking-tight mb-6 flex items-center gap-3'>
                  <div className="w-2 h-2 rounded-full bg-primary" />
                  Activity Timeline
                </h3>
                <div className='space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-border'>
                  {[
                    { label: 'Last App Session', date: user.last_active_at, icon: Clock, color: 'bg-primary' },
                    { label: 'Account Registered', date: user.created_at, icon: Users, color: 'bg-emerald-500' }
                  ].map((event, i) => (
                    <div key={i} className="relative pl-10">
                      <div className={cn("absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center text-white z-10 shadow-lg", event.color)}>
                        <event.icon className="w-3 h-3" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-black text-foreground uppercase tracking-widest">{event.label}</span>
                        <span className="text-[10px] font-bold text-muted-foreground mt-1">
                          {event.date ? new Date(event.date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : 'Pending...'}
                        </span>
                      </div>
                    </div>
                  ))}
                  
                  <div className="relative pl-10 opacity-50">
                     <div className="absolute left-0 top-1 w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground z-10 border border-border">
                        <Shield className="w-3 h-3" />
                     </div>
                     <div className="flex flex-col">
                        <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Initial Onboarding</span>
                        <span className="text-[10px] font-bold text-slate-300 mt-1 italic">Historical logs not available</span>
                     </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className='space-y-6'>
            {!semesterState?.weekly_grid_cache ? (
              <div className='bg-amber-50 border border-amber-200 p-12 rounded-[2rem] text-center'>
                <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <AlertTriangle className='h-8 w-8 text-amber-500' />
                </div>
                <h3 className='text-xl font-black text-amber-900'>No Schedule Cache Found</h3>
                <p className='text-amber-700/70 text-sm font-medium mt-2 max-w-md mx-auto'>
                  The mobile app won't show any classes because the schedule hasn't been generated for this user in the current semester.
                </p>
                <button 
                  onClick={handleRebuildSchedule} 
                  className='mt-8 px-8 py-3 bg-amber-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg shadow-amber-100'
                >
                  Generate Schedule Now
                </button>
              </div>
            ) : (
              <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'>
                {days.map(day => {
                  const dailyClasses = semesterState.weekly_grid_cache![day] || [];
                  return (
                    <motion.div 
                      key={day} 
                      whileHover={{ y: -4 }}
                      className='bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden flex flex-col'
                    >
                      <div className='px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-50 dark:border-white/5 font-black text-[10px] text-slate-400 dark:text-slate-500 uppercase tracking-widest'>{day}</div>
                      <div className='p-6 space-y-4 min-h-[200px]'>
                        {dailyClasses.length === 0 ? (
                          <div className='h-full flex flex-col items-center justify-center text-[10px] text-slate-300 font-bold uppercase tracking-widest py-8'>
                             <Clock className="w-8 h-8 opacity-10 mb-2" />
                             No classes
                          </div>
                        ) : (
                          dailyClasses.map((cls, idx) => (
                            <div key={idx} className='p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 rounded-2xl group hover:bg-white dark:hover:bg-slate-700 hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all'>
                              <div className='flex justify-between items-start mb-2'>
                                <span className='text-xs font-black text-slate-900 dark:text-white'>{cls.courseCode}</span>
                                <span className='text-[8px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-white/10 text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest'>{cls.type}</span>
                              </div>
                              <p className='text-[10px] font-bold text-slate-500 line-clamp-1 mb-3'>{cls.courseName}</p>
                              <div className='flex items-center gap-2 text-[10px] text-indigo-500 font-black mb-3'>
                                <Clock className='w-3 h-3' />
                                {cls.startTime} - {cls.endTime}
                              </div>
                              <div className='flex items-center justify-between mt-auto pt-2 border-t border-slate-100 dark:border-white/5'>
                                <span className='text-[9px] font-black text-slate-900 dark:text-white bg-white dark:bg-slate-800 px-2 py-1 rounded-lg border border-slate-100 dark:border-white/10'>{cls.room}</span>
                                <span className='text-[9px] text-indigo-400 font-black uppercase tracking-tighter'>{cls.faculty}</span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'enrollments' && (
          <div className='space-y-8'>
            {/* Current Semester Section */}
            <div className='bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5'>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className='text-xl font-black text-slate-900 dark:text-white tracking-tight'>Active Academic Load</h3>
                  <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-1">{activeSemesterInfo.current || 'N/A'}</p>
                </div>
                <div className="px-4 py-1.5 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Session
                </div>
              </div>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                {currentEnrollments.length > 0 ? currentEnrollments.map((enr, i) => (
                  <motion.div 
                    key={i} 
                    whileHover={{ y: -2 }}
                    className='border border-slate-100 dark:border-white/5 rounded-[2rem] p-6 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-700 hover:border-indigo-100 dark:hover:border-indigo-500/30 hover:shadow-md transition-all group'
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center font-black text-indigo-500 border border-slate-100 uppercase text-xs">
                         {enr.course_code?.substring(0, 2)}
                      </div>
                      <div>
                        <h4 className='font-black text-slate-900 dark:text-white'>{enr.course_code} <span className="text-indigo-500 text-xs ml-1">Section {enr._sectionDetails?.section_number || (enr as any).section || 'N/A'}</span></h4>
                        <p className='text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1 truncate max-w-[200px]'>{enr._sectionDetails?.course_name || 'Generic Enrollment'}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteEnrollment(enr.id)}
                      className='p-3 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-2xl transition-all opacity-0 group-hover:opacity-100'
                    >
                      <Trash2 className='w-5 h-5' />
                    </button>
                  </motion.div>
                )) : (
                  <div className="md:col-span-2 py-12 text-center bg-slate-50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/5">
                     <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                     <p className='text-slate-400 dark:text-slate-500 font-bold text-xs uppercase tracking-widest'>No current enrollments detected</p>
                  </div>
                )}
              </div>
            </div>

            {/* Next Semester Section */}
            <div className='bg-slate-900 p-8 rounded-[2rem] shadow-xl text-white overflow-hidden relative'>
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none">
                 <CalendarClock className="w-64 h-64" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className='text-xl font-black tracking-tight'>Pre-Advising & Future Planning</h3>
                    <p className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest mt-1">{activeSemesterInfo.next || 'N/A'}</p>
                  </div>
                  <div className="px-4 py-1.5 bg-white/10 backdrop-blur-md text-white rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                    <Clock className="w-3 h-3" />
                    Upcoming
                  </div>
                </div>
                
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                  {nextEnrollments.length > 0 ? nextEnrollments.map((enr, i) => (
                    <motion.div 
                      key={i} 
                      whileHover={{ scale: 1.02 }}
                      className='bg-white/5 border border-white/10 rounded-[2rem] p-6 flex justify-between items-center backdrop-blur-sm hover:bg-white/10 transition-all'
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-black text-indigo-300 border border-white/5 uppercase text-xs">
                           {enr.course_code?.substring(0, 2)}
                        </div>
                        <div>
                          <h4 className='font-black text-white'>{enr.course_code} <span className="text-indigo-300 text-xs ml-1">Section {enr._sectionDetails?.section_number || 'N/A'}</span></h4>
                          <p className='text-[10px] font-bold text-white/40 uppercase tracking-widest mt-1 truncate max-w-[200px]'>{enr._sectionDetails?.course_name || 'Upcoming Course'}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => handleDeleteEnrollment(enr.id)}
                        className='p-3 text-white/20 hover:text-rose-400 hover:bg-white/5 rounded-2xl transition-all'
                      >
                        <Trash2 className='w-5 h-5' />
                      </button>
                    </motion.div>
                  )) : (
                    <div className="md:col-span-2 py-12 text-center bg-white/5 rounded-[2rem] border border-dashed border-white/10">
                       <Clock className="w-8 h-8 text-white/20 mx-auto mb-4" />
                       <p className='text-white/40 font-bold text-xs uppercase tracking-widest'>No future planning records found</p>
                    </div>
                  )}
                </div>
                
                {nextEnrollments.length > 0 && (
                  <div className="mt-8 pt-8 border-t border-white/5 flex items-center justify-between">
                     <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Enrollment Readiness</p>
                     <p className="text-sm font-black text-indigo-300">{nextEnrollments.length} Courses Selected</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className='bg-white dark:bg-slate-800 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 overflow-hidden'>
            <div className='px-8 py-6 border-b border-slate-50 dark:border-white/5 flex items-center justify-between bg-slate-50/30 dark:bg-slate-900/30'>
              <div>
                <h3 className='text-lg font-black text-slate-900 dark:text-white tracking-tight'>Academic History</h3>
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Complete course records from previous semesters</p>
              </div>
              <button 
                onClick={startAddingCourse}
                className='flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-100'
              >
                <Plus className='w-4 h-4' />
                Add Record
              </button>
            </div>
            <div className='overflow-x-auto'>
              <table className='w-full'>
                <thead className="bg-slate-50/50 dark:bg-slate-900/50">
                  <tr>
                    <th className='text-left px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Semester</th>
                    <th className='text-left px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Course Info</th>
                    <th className='text-left px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Grade</th>
                    <th className='text-left px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-center'>Credits</th>
                    <th className='text-right px-8 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Actions</th>
                  </tr>
                </thead>
                <tbody className='divide-y divide-slate-50 dark:divide-white/5'>
                  {completedCourses.map((c, i) => (
                    <tr key={i} className='hover:bg-slate-50/50 dark:hover:bg-white/5 group transition-colors'>
                      <td className='px-8 py-5'>
                        <span className="text-xs font-black text-slate-900 dark:text-white">{c.semester_code}</span>
                      </td>
                      <td className='px-8 py-5'>
                        <div className="font-black text-sm text-slate-900 dark:text-white">{c.course_code}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className={cn(
                            "text-[9px] font-bold uppercase tracking-widest",
                            ['F', 'W', 'I'].includes(c.grade) ? "text-slate-400" : "text-indigo-500"
                          )}>
                            {['F', 'W', 'I'].includes(c.grade) ? 'Attempted' : 'Passed'}
                          </div>
                          {completedCourses.filter(cc => cc.course_code.toUpperCase() === c.course_code.toUpperCase()).length > 1 && (
                            <span className="text-[8px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded font-black uppercase tracking-tighter flex items-center gap-1">
                              <RefreshCw className="w-2 h-2" /> Retake
                            </span>
                          )}
                        </div>
                      </td>
                      <td className='px-8 py-5'>
                        <span className={cn(
                          'px-3 py-1 rounded-lg font-black text-xs border',
                          c.grade === 'F' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 border-rose-100 dark:border-rose-500/20' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-500/20'
                        )}>{c.grade}</span>
                      </td>
                      <td className='px-8 py-5 text-center'>
                        <span className="text-sm font-black text-slate-700 dark:text-slate-300">{c.credits}</span>
                      </td>
                      <td className='px-8 py-5 text-right'>
                        <button 
                          onClick={() => handleDeleteCourse(c.id)}
                          className='p-2 text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {completedCourses.length === 0 && (
                    <tr>
                      <td colSpan={5} className='py-16 text-center'>
                         <div className="text-slate-300 font-bold text-sm uppercase tracking-widest italic">No academic history records</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className='bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5'>
            <h3 className='text-lg font-black text-slate-900 dark:text-white tracking-tight mb-8'>Student Task Ledger</h3>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
              {tasks.length > 0 ? tasks.map((t, i) => (
                <div key={i} className='flex items-center justify-between p-5 border border-slate-100 dark:border-white/5 rounded-[1.5rem] bg-slate-50/50 dark:bg-slate-900/50 hover:bg-white dark:hover:bg-slate-700 hover:shadow-md transition-all'>
                  <div className='flex items-center gap-4'>
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center shadow-sm",
                      t.is_completed ? "bg-emerald-500 text-white" : t.is_missed ? "bg-rose-500 text-white" : "bg-amber-500 text-white"
                    )}>
                      {t.is_completed ? <CheckCircle2 className='h-5 w-5' /> : t.is_missed ? <AlertTriangle className='h-5 w-5' /> : <Clipboard className='h-5 w-5' />}
                    </div>
                    <div>
                      <p className='font-black text-slate-900 dark:text-white text-sm'>{t.title}</p>
                      <p className='text-[10px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-widest'>{t.course_code}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className='text-[10px] font-black text-slate-400 uppercase tracking-widest'>{new Date(t.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
                  </div>
                </div>
              )) : (
                <div className="md:col-span-2 py-12 text-center text-slate-300 font-bold text-sm uppercase tracking-widest">
                   Clean Task List
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'marks' && (
          <div className='bg-white dark:bg-slate-800 p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5'>
            <div className="flex items-center justify-between mb-8">
              <h3 className='text-xl font-black text-slate-900 dark:text-white tracking-tight'>Portal Performance Data</h3>
              <div className="px-4 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-[10px] font-black uppercase tracking-widest">Live Grade Report</div>
            </div>
            
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-8'>
              {marks.length > 0 ? marks.map((m: any, i) => {
                const components = [
                  { key: 'mid', label: 'Midterm', obt: m.obt_mid, dist: m.dist_mid },
                  { key: 'final', label: 'Final', obt: m.obt_final, dist: m.dist_final },
                  { key: 'assignment', label: 'Assignment', obt: m.obt_assignment, dist: m.dist_assignment },
                  { key: 'attendance', label: 'Attendance', obt: m.obt_attendance, dist: m.dist_attendance },
                  { key: 'lab', label: 'Lab', obt: m.obt_lab, dist: m.dist_lab },
                  { key: 'presentation', label: 'Presentation', obt: m.obt_presentation, dist: m.dist_presentation },
                  { key: 'viva', label: 'Viva', obt: m.obt_viva, dist: m.dist_viva },
                  { key: 'project', label: 'Project', obt: m.obt_project, dist: m.dist_project },
                  { key: 'term_paper', label: 'Term Paper', obt: m.obt_term_paper, dist: m.dist_term_paper },
                  { key: 'class_performance', label: 'Class Performance', obt: m.obt_class_performance, dist: m.dist_class_performance },
                ];

                const activeComponents = components.filter(c => c.dist && c.dist > 0);

                return (
                  <motion.div 
                    key={i} 
                    whileHover={{ scale: 1.01 }}
                    className='border border-slate-100 dark:border-white/5 rounded-[2.5rem] overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 shadow-sm'
                  >
                    <div className='px-8 py-6 bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-white/5 flex items-center justify-between'>
                      <div>
                        <h4 className='font-black text-slate-900 dark:text-white text-lg'>{m.course_code}</h4>
                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Graded Component Breakdown</p>
                      </div>
                      <span className='text-[10px] font-black px-3 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full border border-indigo-100 dark:border-indigo-500/20 uppercase tracking-widest'>{m.semester_code}</span>
                    </div>
                    
                    <div className='p-8 space-y-3'>
                      {m.dist_quiz && m.dist_quiz > 0 && (
                        <div className='bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm group hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all'>
                          <div className='flex justify-between items-center'>
                            <div>
                               <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Quizzes ({m.quiz_strategy === 'best_n' ? `Best ${m.quiz_n}` : m.quiz_strategy === 'average_n' ? `Avg of ${m.quiz_n}` : 'All'})</span>
                               <div className="flex gap-1">
                                  {m.obt_quizzes?.map((q: any, qi: number) => (
                                     <span key={qi} className="px-2 py-0.5 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded text-[10px] font-black text-slate-900 dark:text-white">{q}</span>
                                  ))}
                               </div>
                            </div>
                            <span className='text-lg font-black text-indigo-600 dark:text-indigo-400'>{(m.obt_quizzes?.reduce((a:number,b:number)=>a+b,0)/ (m.obt_quizzes?.length || 1)).toFixed(1)} <span className="text-slate-300 dark:text-slate-600 text-xs font-bold">/ {m.dist_quiz}</span></span>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeComponents.map((comp, idx) => (
                          <div key={idx} className='bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-white/5 flex flex-col justify-center shadow-sm group hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all'>
                            <span className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1'>{comp.label}</span>
                            <div className="flex items-baseline gap-1">
                               <span className='text-lg font-black text-slate-900 dark:text-white'>{comp.obt ?? '-'}</span>
                               <span className="text-xs font-bold text-slate-300 dark:text-slate-600">/ {comp.dist}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                );
              }) : (
                <div className="xl:col-span-2 py-24 text-center">
                   <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                      <GraduationCap className="w-10 h-10 text-slate-200" />
                   </div>
                   <p className="text-slate-300 font-bold text-sm uppercase tracking-widest">No graded performance data synced yet</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'notifications' && (
          <div className='space-y-8 animate-in fade-in duration-500'>
            {/* Header & Local Device Notification Overview */}
            <div className='grid grid-cols-1 md:grid-cols-3 gap-6'>
              <div className='bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm'>
                <div className='flex items-center gap-3 mb-3'>
                  <div className='p-2.5 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl'>
                    <Smartphone className='w-5 h-5 text-emerald-600 dark:text-emerald-400' />
                  </div>
                  <div>
                    <h4 className='text-sm font-black text-slate-900 dark:text-white'>Device Deployments</h4>
                    <p className='text-[10px] text-slate-400 dark:text-slate-500'>Active offline schedulers</p>
                  </div>
                </div>
                <p className='text-2xl font-black text-slate-900 dark:text-white'>
                  {localNotifStates.length} <span className='text-xs font-semibold text-slate-400'>registered device(s)</span>
                </p>
              </div>

              <div className='bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm'>
                <div className='flex items-center gap-3 mb-3'>
                  <div className='p-2.5 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl'>
                    <BellRing className='w-5 h-5 text-indigo-600 dark:text-indigo-400' />
                  </div>
                  <div>
                    <h4 className='text-sm font-black text-slate-900 dark:text-white'>Local Alarms Queued</h4>
                    <p className='text-[10px] text-slate-400 dark:text-slate-500'>Upcoming 7-day window</p>
                  </div>
                </div>
                <p className='text-2xl font-black text-indigo-600 dark:text-indigo-400'>
                  {localNotifStates.reduce((acc, curr) => acc + (curr.scheduled_count || 0), 0)} <span className='text-xs font-semibold text-slate-400'>scheduled alarms</span>
                </p>
              </div>

              <div className='bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm'>
                <div className='flex items-center gap-3 mb-3'>
                  <div className='p-2.5 bg-purple-50 dark:bg-purple-500/10 rounded-2xl'>
                    <Clock className='w-5 h-5 text-purple-600 dark:text-purple-400' />
                  </div>
                  <div>
                    <h4 className='text-sm font-black text-slate-900 dark:text-white'>Custom Reminders</h4>
                    <p className='text-[10px] text-slate-400 dark:text-slate-500'>User configured lead times</p>
                  </div>
                </div>
                <p className='text-2xl font-black text-purple-600 dark:text-purple-400'>
                  {Object.keys(user.reminder_settings || {}).length} <span className='text-xs font-semibold text-slate-400'>course(s) customized</span>
                </p>
              </div>
            </div>

            {/* Custom Lead Times per Course */}
            <div className='bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-100 dark:border-white/5 shadow-sm space-y-4'>
              <h3 className='text-base font-black text-slate-900 dark:text-white flex items-center gap-2'>
                <Clock className='w-5 h-5 text-indigo-500' />
                Course-Specific Alarm Lead Times
              </h3>
              {Object.keys(user.reminder_settings || {}).length === 0 ? (
                <p className='text-xs text-slate-400 italic py-2'>Default intelligent gap rules are active (60m, 30m, 15m for 1st class; 5m for back-to-back classes).</p>
              ) : (
                <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3'>
                  {Object.entries(user.reminder_settings || {}).map(([course, minutes]) => (
                    <div key={course} className='p-3.5 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200/60 dark:border-white/5 flex items-center justify-between'>
                      <span className='font-black text-xs text-slate-900 dark:text-white font-mono'>{course}</span>
                      <div className='flex gap-1.5'>
                        {(Array.isArray(minutes) ? minutes : []).map(m => (
                          <span key={m} className='text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full'>
                            {m}m
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Local Notification States (Device sync & offline health) */}
            <div className='bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden'>
              <div className='p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between'>
                <div>
                  <h3 className='text-base font-black text-slate-900 dark:text-white flex items-center gap-2'>
                    <Smartphone className='w-5 h-5 text-emerald-500' />
                    Device Local Notification Deployments
                  </h3>
                  <p className='text-xs text-slate-400 mt-0.5'>Telemetry synced when device calculates 7-day rolling local reminders</p>
                </div>
              </div>

              {localNotifStates.length === 0 ? (
                <div className='p-12 text-center text-slate-400 text-xs italic'>
                  No local notification state has been synced yet. State syncs automatically when the student opens the app.
                </div>
              ) : (
                <div className='divide-y divide-slate-100 dark:divide-white/5'>
                  {localNotifStates.map((st) => (
                    <div key={st.id} className='p-6 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors space-y-4'>
                      <div className='flex flex-wrap items-center justify-between gap-3'>
                        <div className='flex items-center gap-3'>
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            st.platform === 'android' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                            st.platform === 'ios' ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                            'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                          }`}>
                            {st.platform}
                          </span>
                          <span className='font-mono font-bold text-xs text-slate-700 dark:text-slate-300'>
                            Device ID: {st.device_id}
                          </span>
                          {st.semester_code && (
                            <span className='text-[10px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-2 py-0.5 rounded-full'>
                              {st.semester_code}
                            </span>
                          )}
                        </div>
                        <div className='text-right'>
                          <span className='text-[10px] text-slate-400 font-mono'>
                            Last scheduled: {new Date(st.last_scheduled_at).toLocaleString()}
                          </span>
                        </div>
                      </div>

                      <div className='grid grid-cols-2 sm:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-2xl'>
                        <div>
                          <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>Scheduled Alarms</p>
                          <p className='text-lg font-black text-slate-900 dark:text-white mt-0.5'>{st.scheduled_count}</p>
                        </div>
                        <div>
                          <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>App Version</p>
                          <p className='text-sm font-black text-slate-900 dark:text-white mt-0.5'>{st.metadata?.app_version || 'N/A'}</p>
                        </div>
                        <div>
                          <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>OS Version</p>
                          <p className='text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5 truncate' title={st.metadata?.os_version}>{st.metadata?.os_version || 'N/A'}</p>
                        </div>
                        <div>
                          <p className='text-[10px] font-black uppercase tracking-widest text-slate-400'>Next Alert</p>
                          <p className='text-xs font-semibold text-slate-700 dark:text-slate-300 mt-0.5'>
                            {st.metadata?.next_alert_time ? new Date(st.metadata.next_alert_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'None pending'}
                          </p>
                        </div>
                      </div>

                      {st.active_keys && st.active_keys.length > 0 && (
                        <div>
                          <p className='text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2'>Active Alert Keys ({st.active_keys.length})</p>
                          <div className='flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1'>
                            {st.active_keys.map((k) => (
                              <span key={k} className='text-[9px] font-mono bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400'>
                                {k}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Cloud Push Notifications History for this User */}
            <div className='bg-white dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden'>
              <div className='p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-900/50'>
                <h3 className='text-base font-black text-slate-900 dark:text-white flex items-center gap-2'>
                  <BellRing className='w-5 h-5 text-indigo-500' />
                  Cloud Push Notification Log
                </h3>
                <p className='text-xs text-slate-400 mt-0.5'>FCM push records dispatched by server / scheduler</p>
              </div>

              {userPushNotifications.length === 0 ? (
                <div className='p-12 text-center text-slate-400 text-xs italic'>
                  No server push notification records found for this student.
                </div>
              ) : (
                <div className='divide-y divide-slate-100 dark:divide-white/5 max-h-96 overflow-y-auto custom-scrollbar'>
                  {userPushNotifications.map((n) => (
                    <div key={n.id} className='p-4 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors flex items-center justify-between gap-4'>
                      <div className='min-w-0 flex-1'>
                        <div className='flex items-center gap-2 mb-1'>
                          <span className='font-bold text-xs text-slate-900 dark:text-white truncate'>{n.title}</span>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-full ${n.is_dispatched ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600'}`}>
                            {n.is_dispatched ? 'Dispatched' : 'Pending'}
                          </span>
                          <span className='text-[8px] font-mono bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-slate-500'>
                            {n.type}
                          </span>
                        </div>
                        <p className='text-xs text-slate-500 dark:text-slate-400 truncate'>{n.body}</p>
                      </div>
                      <div className='text-right text-[10px] text-slate-400 font-mono shrink-0'>
                        {new Date(n.trigger_at || n.created_at).toLocaleString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {isEditingProfile && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in'>
          <div className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-white/5'>
            <div className='px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50'>
              <h3 className='text-xl font-black text-slate-900 dark:text-white tracking-tight'>Edit Student Profile</h3>
              <button onClick={() => setIsEditingProfile(false)} className='p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors'>
                <X className='h-5 w-5 text-slate-500' />
              </button>
            </div>
            <div className='p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar'>
              <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Full Name</label>
                  <input 
                    type='text' 
                    value={editForm.full_name || ''} 
                    onChange={e => setEditForm({...editForm, full_name: e.target.value})}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all'
                  />
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Student ID</label>
                  <input 
                    type='text' 
                    value={editForm.student_id || ''} 
                    onChange={e => setEditForm({...editForm, student_id: e.target.value})}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Nickname</label>
                  <input 
                    type='text' 
                    value={editForm.nickname || ''} 
                    onChange={e => setEditForm({...editForm, nickname: e.target.value})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div className='space-y-1 md:col-span-2'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Select Program</label>
                  <select 
                    value={editForm.program_code || ''} 
                    onChange={e => {
                      const prog = availablePrograms.find(p => p.program_code === e.target.value);
                      if (prog) {
                        setEditForm({
                          ...editForm, 
                          program_code: prog.program_code,
                          program_name: prog.name,
                          department_name: prog.department_name,
                          track: prog.track
                        });
                      } else {
                        setEditForm({...editForm, program_code: e.target.value});
                      }
                    }}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  >
                    <option value=''>-- Choose a Program --</option>
                    {availablePrograms.map(p => (
                      <option key={p.program_code} value={p.program_code}>{p.program_code} - {p.name}</option>
                    ))}
                  </select>
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Program Name (Display)</label>
                  <input 
                    type='text' 
                    value={editForm.program_name || ''} 
                    onChange={e => setEditForm({...editForm, program_name: e.target.value})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Department Name (Display)</label>
                  <input 
                    type='text' 
                    value={editForm.department_name || ''} 
                    onChange={e => setEditForm({...editForm, department_name: e.target.value})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none bg-gray-50'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>CGPA</label>
                  <input 
                    type='number' 
                    step='0.01'
                    value={editForm.cgpa || 0} 
                    onChange={e => setEditForm({...editForm, cgpa: parseFloat(e.target.value)})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Total Credits</label>
                  <input 
                    type='number' 
                    value={editForm.total_credits_earned || 0} 
                    onChange={e => setEditForm({...editForm, total_credits_earned: parseInt(e.target.value)})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  />
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Track</label>
                  <select 
                    value={editForm.track || 'tri_semester'} 
                    onChange={e => setEditForm({...editForm, track: e.target.value as any})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  >
                    <option value='tri_semester'>Tri-Semester</option>
                    <option value='bi_semester'>Bi-Semester</option>
                  </select>
                </div>
                <div className='space-y-1'>
                  <label className='text-xs font-bold text-gray-500 uppercase'>Onboarding Status</label>
                  <select 
                    value={editForm.onboarding_status || 'registered'} 
                    onChange={e => setEditForm({...editForm, onboarding_status: e.target.value})}
                    className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none'
                  >
                    <option value='registered'>Registered</option>
                    <option value='course_history'>Course History</option>
                    <option value='completed'>Completed</option>
                  </select>
                </div>
              </div>
            </div>
            <div className='px-8 py-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/50'>
              <button 
                onClick={() => setIsEditingProfile(false)}
                className='px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all'
              >
                Cancel
              </button>
              <button 
                onClick={handleUpdateProfile}
                disabled={saving}
                className='flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none transition-all'
              >
                {saving ? <RefreshCw className='h-4 w-4 animate-spin' /> : <Save className='h-4 w-4' />}
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isAddingCourse && (
        <div className='fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in'>
          <div className='bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-white/5'>
            <div className='px-8 py-6 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50'>
              <h3 className='text-xl font-black text-slate-900 dark:text-white tracking-tight'>Add Course Record</h3>
              <button onClick={() => setIsAddingCourse(false)} className='p-2 hover:bg-slate-200 dark:hover:bg-white/10 rounded-full transition-colors'>
                <X className='h-5 w-5 text-slate-500' />
              </button>
            </div>
            <div className='p-8 space-y-6'>
              <div className='space-y-1.5'>
                <label className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Semester Code</label>
                <input 
                  type='text' 
                  placeholder='e.g. Summer 2026'
                  value={courseForm.semester_code || ''} 
                  onChange={e => setCourseForm({...courseForm, semester_code: e.target.value})}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all'
                />
              </div>
              <div className='space-y-1.5'>
                <label className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Course Code</label>
                <input 
                  type='text' 
                  placeholder='e.g. CSE103'
                  value={courseForm.course_code || ''} 
                  onChange={e => setCourseForm({...courseForm, course_code: e.target.value.toUpperCase()})}
                  className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all'
                />
              </div>
              <div className='grid grid-cols-2 gap-6'>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Grade</label>
                  <select 
                    value={courseForm.grade || 'A'} 
                    onChange={e => setCourseForm({...courseForm, grade: e.target.value})}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all'
                  >
                    {['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'F', 'I', 'W'].map(g => (
                      <option key={g} value={g} className="dark:bg-slate-900">{g}</option>
                    ))}
                  </select>
                </div>
                <div className='space-y-1.5'>
                  <label className='text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest'>Credits</label>
                  <input 
                    type='number' 
                    step='0.5'
                    value={courseForm.credits || 3.0} 
                    onChange={e => setCourseForm({...courseForm, credits: parseFloat(e.target.value)})}
                    className='w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-900 dark:text-white transition-all'
                  />
                </div>
              </div>
            </div>
            <div className='px-8 py-6 border-t border-slate-100 dark:border-white/5 flex items-center justify-end gap-3 bg-slate-50 dark:bg-slate-900/50'>
              <button 
                onClick={() => setIsAddingCourse(false)}
                className='px-6 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 rounded-2xl transition-all'
              >
                Cancel
              </button>
              <button 
                onClick={handleAddCourse}
                disabled={saving || !courseForm.course_code || !courseForm.semester_code}
                className='flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 disabled:opacity-50 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-100 dark:shadow-none transition-all'
              >
                {saving ? <RefreshCw className='h-4 w-4 animate-spin' /> : <Plus className='h-4 w-4' />}
                {saving ? 'Adding...' : 'Add Record'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
