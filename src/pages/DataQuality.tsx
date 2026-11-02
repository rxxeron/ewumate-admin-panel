import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ShieldCheck, AlertTriangle, Copy, Search, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../lib/utils';

interface QualityIssue {
  id: string;
  course_code: string;
  course_name: string | null;
  section_number: number | null;
  faculty_initials: string | null;
  credit_val: number | null;
  issues: string[];
}

interface DuplicateGroup {
  key: string;
  count: number;
  ids: string[];
}

interface QualityStats {
  totalSections: number;
  totalUniqueCourses: number;
  completePercent: number;
  missingFaculty: number;
  missingName: number;
  missingCredits: number;
  duplicates: number;
}

interface UserQualityIssue {
  id: string;
  full_name: string;
  student_id: string;
  program_code: string;
  department_name: string;
  issues: string[];
  status: string;
}

interface UserQualityStats {
  totalUsers: number;
  completeUsers: number;
  completePercent: number;
  registeredCount: number;
  historyCount: number;
  missingDept: number;
  missingProg: number;
  anomalousCredits: number;
}

export function DataQuality() {
  const navigate = useNavigate();
  const [activeSemester, setActiveSemester] = useState('');
  const [loading, setLoading] = useState(true);
  const [auditType, setAuditType] = useState<'courses' | 'users'>('courses');
  
  // Courses states
  const [issues, setIssues] = useState<QualityIssue[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateGroup[]>([]);
  const [stats, setStats] = useState<QualityStats | null>(null);
  
  // Users states
  const [userIssues, setUserIssues] = useState<UserQualityIssue[]>([]);
  const [userStats, setUserStats] = useState<UserQualityStats | null>(null);
  const [userFilter, setUserFilter] = useState<'all' | 'completed' | 'incomplete' | 'stage1' | 'stage2' | 'anomalies'>('all');

  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    fetchActiveSemester();
  }, []);

  useEffect(() => {
    if (activeSemester || auditType === 'users') runAudit();
  }, [activeSemester, auditType]);

  async function fetchActiveSemester() {
    const { data } = await supabase
      .from('active_semester')
      .select('current_semester_code')
      .eq('track', 'tri_semester')
      .maybeSingle();

    if (data?.current_semester_code) {
      setActiveSemester(data.current_semester_code);
    } else {
      setLoading(false);
    }
  }

  async function runAudit() {
    setLoading(true);
    try {
      if (auditType === 'courses') {
        const cleanSem = activeSemester.replace(/\s+/g, '').replace(/_/g, '').toLowerCase();
        const tableName = `courses_${cleanSem}`;

        // Fetch all courses from the semester table
        let allCourses: Record<string, any>[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from(tableName)
            .select('id, course_code, course_name, section_number, faculty_initials, credit_val')
            .range(from, from + 999);

          if (error) {
            toast.error(`Table "${tableName}" not found or error: ${error.message}`);
            setLoading(false);
            return;
          }
          if (!data || data.length === 0) break;
          allCourses = [...allCourses, ...data];
          if (data.length < 1000) break;
          from += 1000;
        }

        // Find issues
        const foundIssues: QualityIssue[] = [];
        let missingFaculty = 0;
        let missingName = 0;
        let missingCredits = 0;

        for (const course of allCourses) {
          const courseIssues: string[] = [];
          
          if (!course.faculty_initials || (course.faculty_initials as string).trim() === '' || course.faculty_initials === 'TBA') {
            courseIssues.push('Missing faculty');
            missingFaculty++;
          }
          if (!course.course_name || (course.course_name as string).trim() === '') {
            courseIssues.push('Missing course name');
            missingName++;
          }
          if (course.credit_val === null || course.credit_val === undefined) {
            courseIssues.push('Missing credits');
            missingCredits++;
          }

          if (courseIssues.length > 0) {
            foundIssues.push({
              id: course.id as string,
              course_code: course.course_code as string,
              course_name: course.course_name as string | null,
              section_number: course.section_number as number | null,
              faculty_initials: course.faculty_initials as string | null,
              credit_val: course.credit_val as number | null,
              issues: courseIssues
            });
          }
        }

        // Find duplicates (same course_code + section_number)
        const groupMap: Record<string, string[]> = {};
        for (const course of allCourses) {
          const key = `${course.course_code}-${course.section_number || '?'}`;
          if (!groupMap[key]) groupMap[key] = [];
          groupMap[key].push(course.id as string);
        }
        
        const foundDuplicates: DuplicateGroup[] = [];
        for (const [key, ids] of Object.entries(groupMap)) {
          if (ids.length > 1) {
            foundDuplicates.push({ key, count: ids.length, ids });
          }
        }

        // Calculate stats
        const uniqueCodes = new Set(allCourses.map(c => c.course_code));
        const completeCount = allCourses.length - foundIssues.length;

        setIssues(foundIssues);
        setDuplicates(foundDuplicates);
        setStats({
          totalSections: allCourses.length,
          totalUniqueCourses: uniqueCodes.size,
          completePercent: allCourses.length > 0 ? Math.round((completeCount / allCourses.length) * 100) : 100,
          missingFaculty,
          missingName,
          missingCredits,
          duplicates: foundDuplicates.length
        });
      } else {
        // User Profile Audit
        let allProfiles: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, student_id, program_code, department_name, onboarding_status, total_credits_earned, cgpa')
            .range(from, from + 999);

          if (error) {
            toast.error('Failed to query profiles: ' + error.message);
            setLoading(false);
            return;
          }
          if (!data || data.length === 0) break;
          allProfiles = [...allProfiles, ...data];
          if (data.length < 1000) break;
          from += 1000;
        }

        const foundUserIssues: UserQualityIssue[] = [];
        let completedCount = 0;
        let registeredCount = 0;
        let historyCount = 0;
        let missingDept = 0;
        let missingProg = 0;
        let anomalousCredits = 0;

        for (const p of allProfiles) {
          const pIssues: string[] = [];

          if (!p.full_name || p.full_name.trim() === '') {
            pIssues.push('Missing profile name');
          }
          if (!p.student_id || p.student_id.trim() === '') {
            pIssues.push('Missing Student ID');
          }

          // Department / Program gaps
          if (!p.department_name) {
            pIssues.push('Missing department');
            missingDept++;
          }
          if (!p.program_code) {
            pIssues.push('Missing program code');
            missingProg++;
          }

          // Onboarding splits
          const status = p.onboarding_status || 'registered';
          if (status === 'completed') {
            completedCount++;
          } else if (status === 'course_history') {
            historyCount++;
            pIssues.push('Onboarding incomplete (Stage 2)');
          } else {
            registeredCount++;
            pIssues.push('Onboarding incomplete (Stage 1)');
          }

          // anomalous stats
          if ((p.total_credits_earned || 0) > 0 && (p.cgpa || 0) === 0) {
            pIssues.push('Unsynced CGPA (CGPA is 0.0 despite earned credits)');
            anomalousCredits++;
          }

          foundUserIssues.push({
            id: p.id,
            full_name: p.full_name || 'Anonymous Student',
            student_id: p.student_id || 'ID Pending',
            program_code: p.program_code || 'Unassigned',
            department_name: p.department_name || 'Unassigned',
            issues: pIssues,
            status: status
          });
        }

        setUserIssues(foundUserIssues);
        setUserStats({
          totalUsers: allProfiles.length,
          completeUsers: completedCount,
          completePercent: allProfiles.length > 0 ? Math.round((completedCount / allProfiles.length) * 100) : 100,
          registeredCount,
          historyCount,
          missingDept,
          missingProg,
          anomalousCredits
        });
      }
    } catch (err: any) {
      toast.error('Audit failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = issues.filter(i =>
    !searchFilter ||
    i.course_code.toLowerCase().includes(searchFilter.toLowerCase()) ||
    (i.course_name || '').toLowerCase().includes(searchFilter.toLowerCase())
  );

  const filteredUsers = userIssues.filter(u => {
    // Search filter
    const matchesSearch = !searchFilter ||
      u.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      u.student_id.toLowerCase().includes(searchFilter.toLowerCase()) ||
      u.program_code.toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;

    // Integrity focus options filter
    if (userFilter === 'all') return true;
    if (userFilter === 'completed') return u.status === 'completed' && u.issues.filter(i => !i.includes('incomplete')).length === 0;
    if (userFilter === 'incomplete') return u.status !== 'completed';
    if (userFilter === 'stage1') return u.status === 'registered';
    if (userFilter === 'stage2') return u.status === 'course_history';
    if (userFilter === 'anomalies') return u.issues.some(i => !i.includes('incomplete'));

    return true;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-3">
            <ShieldCheck className="w-8 h-8 text-primary dark:text-primary" />
            Data Integrity Guard
          </h1>
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider mt-1">
            {auditType === 'courses' ? (
              <>Auditing <span className="text-primary dark:text-primary">{activeSemester || '...'}</span> for catalog anomalies</>
            ) : (
              <>Auditing global student profile database for vitals anomalies</>
            )}
          </p>
        </div>
        <button
          onClick={runAudit}
          disabled={loading || (auditType === 'courses' && !activeSemester)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-card border border-border rounded-lg shadow-sm hover:bg-accent hover:text-accent-foreground text-foreground font-semibold text-[10px] uppercase tracking-wider transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Execute Audit
        </button>
      </div>

      {/* Audit Type Tab bar */}
      <div className="flex gap-2 border-b border-border pb-px overflow-x-auto">
        <button
          onClick={() => { setAuditType('courses'); setSearchFilter(''); }}
          className={`flex items-center gap-2 px-6 py-4 font-semibold text-[10px] uppercase tracking-wider border-b-2 whitespace-nowrap ${
            auditType === 'courses' 
              ? 'border-indigo-600 text-primary dark:text-primary bg-primary/10/30 dark:bg-primary/5' 
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          Catalog Integrity
        </button>
        <button
          onClick={() => { setAuditType('users'); setSearchFilter(''); }}
          className={`flex items-center gap-2 px-6 py-4 font-semibold text-[10px] uppercase tracking-wider border-b-2 whitespace-nowrap ${
            auditType === 'users' 
              ? 'border-indigo-600 text-primary dark:text-primary bg-primary/10/30 dark:bg-primary/5' 
              : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-slate-300'
          }`}
        >
          Student Profile Integrity
        </button>
      </div>

      {/* Stats Cards */}
      {auditType === 'courses' ? (
        stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card rounded-3xl shadow-sm border border-border p-6">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Sections</p>
              <p className="text-3xl font-semibold text-foreground mt-1">{stats.totalSections}</p>
              <p className="text-[10px] text-primary font-semibold uppercase tracking-wider mt-2">{stats.totalUniqueCourses} Unique Courses</p>
            </div>
            <div className={`rounded-3xl shadow-sm border p-6 ${stats.completePercent >= 95 ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20' : stats.completePercent >= 80 ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'}`}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Completeness Score</p>
              <p className={`text-3xl font-semibold mt-1 ${stats.completePercent >= 95 ? 'text-primary dark:text-primary' : stats.completePercent >= 80 ? 'text-primary dark:text-primary' : 'text-rose-600 dark:text-rose-400'}`}>{stats.completePercent}%</p>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mt-2">{issues.length} Flagged Sections</p>
            </div>
            <div className="bg-card rounded-3xl shadow-sm border border-border p-6">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Identity Gaps</p>
              <p className={`text-3xl font-semibold mt-1 ${stats.missingFaculty > 0 ? 'text-primary' : 'text-primary'}`}>{stats.missingFaculty}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-2">Missing Faculty Initials</p>
            </div>
            <div className="bg-card rounded-3xl shadow-sm border border-border p-6">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Duplicates</p>
              <p className={`text-3xl font-semibold mt-1 ${stats.duplicates > 0 ? 'text-rose-500' : 'text-primary'}`}>{stats.duplicates}</p>
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-2">Section Overlaps</p>
            </div>
          </div>
        )
      ) : (
        userStats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Total Students</p>
                <p className="text-3xl font-semibold text-foreground mt-1">{userStats.totalUsers.toLocaleString()}</p>
              </div>
              <div className="flex gap-4 border-t border-border pt-3 mt-3">
                <div>
                  <p className="text-primary font-semibold text-xs">{userStats.completeUsers}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Complete</p>
                </div>
                <div>
                  <p className="text-primary font-semibold text-xs">{userStats.registeredCount + userStats.historyCount}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Incomplete</p>
                </div>
              </div>
            </div>
            <div className={`rounded-3xl shadow-sm border p-6 ${userStats.completePercent >= 90 ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20' : userStats.completePercent >= 70 ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20' : 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20'}`}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Onboarding Success Rate</p>
              <p className={`text-3xl font-semibold mt-1 ${userStats.completePercent >= 90 ? 'text-primary dark:text-primary' : userStats.completePercent >= 70 ? 'text-primary dark:text-primary' : 'text-rose-600 dark:text-rose-400'}`}>{userStats.completePercent}%</p>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mt-2">{userIssues.length} Students in Drop-Off</p>
            </div>
            <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stage Drop-offs</p>
                <p className="text-3xl font-semibold text-primary mt-1">{userStats.registeredCount + userStats.historyCount}</p>
              </div>
              <div className="flex gap-4 border-t border-border pt-3 mt-3">
                <div>
                  <p className="text-primary font-semibold text-xs">{userStats.registeredCount}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Stage 1 (Reg)</p>
                </div>
                <div>
                  <p className="text-primary font-semibold text-xs">{userStats.historyCount}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Stage 2 (Hist)</p>
                </div>
              </div>
            </div>
            <div className="bg-card rounded-3xl shadow-sm border border-border p-6 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Vitals Anomalies</p>
                <p className="text-3xl font-semibold text-rose-500 mt-1">{userStats.missingDept + userStats.missingProg + userStats.anomalousCredits}</p>
              </div>
              <div className="flex gap-3 border-t border-border pt-3 mt-3">
                <div>
                  <p className="text-rose-400 font-semibold text-xs">{userStats.missingDept}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">No Dept</p>
                </div>
                <div>
                  <p className="text-rose-400 font-semibold text-xs">{userStats.missingProg}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">No Prog</p>
                </div>
                <div>
                  <p className="text-rose-400 font-semibold text-xs">{userStats.anomalousCredits}</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase">Unsynced</p>
                </div>
              </div>
            </div>
          </div>
        )
      )}

      {/* Catalog Duplicates (Only visible for courses) */}
      {auditType === 'courses' && duplicates.length > 0 && (
        <div className="bg-rose-50 dark:bg-rose-500/10 rounded-3xl shadow-sm border border-rose-100 dark:border-rose-500/20 overflow-hidden animate-in slide-in-from-top-4">
          <div className="px-8 py-5 border-b border-rose-100 dark:border-rose-500/20 flex items-center gap-3">
            <Copy className="w-5 h-5 text-rose-500" />
            <h3 className="text-lg font-semibold text-rose-900 dark:text-white tracking-tight">Duplication Matrix ({duplicates.length})</h3>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {duplicates.map(d => (
              <div key={d.key} className="bg-card p-4 rounded-lg border border-rose-100 dark:border-border flex justify-between items-center shadow-sm">
                <span className="font-semibold text-sm text-foreground tracking-tight">{d.key}</span>
                <span className="bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[10px] font-semibold px-2.5 py-1 rounded-lg uppercase">{d.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Issues Table */}
      <div className="bg-card rounded-3xl shadow-sm border border-border overflow-hidden">
        <div className="px-8 py-6 border-b border-border flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/20 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-primary" />
            <h3 className="text-xl font-semibold text-foreground tracking-tight">
              Audit Log ({auditType === 'courses' ? filtered.length : filteredUsers.length} Alerts)
            </h3>
          </div>
          <div className="relative w-full md:w-80">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchFilter}
              onChange={e => setSearchFilter(e.target.value)}
              placeholder={auditType === 'courses' ? "Search course code or name..." : "Search student ID, name, or code..."}
              className="w-full pl-11 pr-4 py-3 bg-background border border-slate-100 dark:border-border rounded-lg text-sm font-semibold text-foreground focus:ring-4 focus:ring-ring outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-600 shadow-sm"
            />
          </div>
        </div>

        {/* Integrity Focus Options Selector (Only for User Audits) */}
        {!loading && auditType === 'users' && userStats && (
          <div className="px-8 py-4 bg-muted/30 border-b border-border flex flex-wrap gap-3">
            {[
              { id: 'all', label: 'All Students', count: userStats.totalUsers },
              { id: 'completed', label: 'Optimal Profiles', count: userStats.completeUsers },
              { id: 'incomplete', label: 'Incomplete Onboarding', count: userStats.registeredCount + userStats.historyCount },
              { id: 'stage1', label: 'Stage 1 Drop-offs', count: userStats.registeredCount },
              { id: 'stage2', label: 'Stage 2 Drop-offs', count: userStats.historyCount },
              { id: 'anomalies', label: 'Vitals Anomalies', count: userStats.missingDept + userStats.missingProg + userStats.anomalousCredits },
            ].map(opt => {
              const isActive = userFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setUserFilter(opt.id as any)}
                  className={cn(
                    "flex items-center gap-2 px-3.5 py-2 border rounded-xl text-[10px] font-semibold uppercase tracking-wider transition-all cursor-pointer",
                    isActive
                      ? 'bg-primary border-indigo-600 text-white shadow-lg shadow-sm dark:shadow-none'
                      : 'bg-card border-border text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'
                  )}
                >
                  <span>{opt.label}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 rounded-lg text-[9px] font-semibold border ml-1",
                    isActive
                      ? 'bg-white/20 border-white/20 text-white'
                      : 'bg-slate-50 dark:bg-slate-800 border-border text-muted-foreground'
                  )}>
                    {opt.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        
        {loading ? (
          <div className="p-24 text-center">
            <RefreshCw className="w-12 h-12 text-primary animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider">Scanning central repository...</p>
          </div>
        ) : auditType === 'courses' ? (
          filtered.length === 0 ? (
            <div className="p-24 text-center">
              <ShieldCheck className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="text-xl font-semibold text-foreground tracking-tight">All Clear!</p>
              <p className="text-sm text-muted-foreground font-medium mt-1">No data quality anomalies detected in this quadrant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Course Code</th>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Identification</th>
                    <th className="px-8 py-5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sec</th>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Faculty / Credits</th>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Anomaly Signature</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {filtered.slice(0, 100).map(issue => (
                    <tr key={issue.id} className="hover:bg-primary/10/30 dark:hover:bg-primary/5 transition-colors group">
                      <td className="px-8 py-5 text-sm font-semibold text-foreground tracking-tight">{issue.course_code}</td>
                      <td className="px-8 py-5">
                        <div className="text-sm font-bold text-foreground">{issue.course_name || <span className="text-rose-500 italic">Missing Signature</span>}</div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <div className="w-8 h-8 mx-auto flex items-center justify-center bg-background rounded-lg text-xs font-semibold text-foreground border border-border">{issue.section_number ?? '—'}</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-semibold text-primary dark:text-primary uppercase">{issue.faculty_initials || <span className="text-rose-500">TBA</span>}</div>
                        <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5">{issue.credit_val ?? '0.0'} Credits</div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {issue.issues.map((iss, idx) => (
                            <span key={idx} className="text-[10px] font-semibold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 rounded-lg border border-rose-100 dark:border-rose-500/20 uppercase tracking-tighter">{iss}</span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length > 100 && (
                <div className="p-6 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  Truncated View: Showing 100 of {filtered.length} Alerts. Refine search for full access.
                </div>
              )}
            </div>
          )
        ) : (
          filteredUsers.length === 0 ? (
            <div className="p-24 text-center">
              <ShieldCheck className="w-16 h-16 text-primary mx-auto mb-4" />
              <p className="text-xl font-semibold text-foreground tracking-tight">Ecosystem Optimal</p>
              <p className="text-sm text-muted-foreground font-medium mt-1">100% of analyzed profiles conform to onboarding specs.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border">
                  <tr>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Student Profile</th>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Departmental Hub</th>
                    <th className="px-8 py-5 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Onboarding Status</th>
                    <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Anomaly Signatures</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {filteredUsers.slice(0, 100).map(u => (
                    <tr 
                      key={u.id} 
                      onClick={() => navigate(`/users/${u.id}`)}
                      className="hover:bg-primary/10/30 dark:hover:bg-primary/5 transition-colors group cursor-pointer"
                    >
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-primary/10 dark:bg-primary/10 flex items-center justify-center font-semibold text-primary text-xs shrink-0 group-hover:scale-105 transition-transform">
                            {u.full_name.substring(0, 1)}
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">{u.full_name}</div>
                            <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{u.student_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5">
                        <div className="text-xs font-semibold text-foreground">{u.program_code}</div>
                        <div className="text-[9px] font-bold text-muted-foreground uppercase mt-0.5 leading-none">{u.department_name}</div>
                      </td>
                      <td className="px-8 py-5 text-center">
                        <span className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-semibold uppercase tracking-wider shadow-sm border",
                          u.status === 'completed' 
                            ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20'
                            : u.status === 'course_history'
                            ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20'
                            : 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20'
                        )}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-8 py-5">
                        <div className="flex flex-wrap gap-1.5">
                          {u.issues.length === 0 ? (
                            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg border uppercase tracking-tighter bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20">
                              Optimal Profile
                            </span>
                          ) : (
                            u.issues.map((iss, idx) => (
                              <span 
                                key={idx} 
                                className={cn(
                                  "text-[10px] font-semibold px-2.5 py-1 rounded-lg border uppercase tracking-tighter",
                                  iss.includes('incomplete')
                                    ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20'
                                    : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20'
                                )}
                              >
                                {iss}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length > 100 && (
                <div className="p-6 text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-muted/50">
                  Truncated View: Showing 100 of {filteredUsers.length} Alerts. Refine search for full access.
                </div>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}
