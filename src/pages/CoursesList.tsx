import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BookOpen, Search, ChevronLeft, ChevronRight, Calendar, Filter, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CourseSection, Semester } from '../types';
import { Skeleton } from '../components/Skeleton';
import { toCourseTableName } from '../lib/academicUtils';

export function CoursesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<CourseSection[]>([]);
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const searchTerm = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '0');
  const pageSize = 20;

  const setPage = (p: number | ((prev: number) => number)) => {
    const newPage = typeof p === 'function' ? p(page) : p;
    setSearchParams(prev => { prev.set('page', String(newPage)); return prev; });
  };

  const setSearchTerm = (val: string) => {
    setSearchParams(prev => {
      if (val) prev.set('q', val); else prev.delete('q');
      prev.set('page', '0');
      return prev;
    });
  };

  useEffect(() => {
    fetchSemesters();
  }, []);

  async function fetchSemesters() {
    const { data } = await supabase.from('semesters').select('*').order('created_at', { ascending: false });
    if (data && data.length > 0) {
      setSemesters(data);
      const active = data.find(s => s.is_active);
      setSelectedSemester(active ? active.code : data[0].code);
    }
  }

  useEffect(() => {
    if (selectedSemester) {
      fetchCourses();
    }
  }, [selectedSemester, page, searchTerm]);

  async function fetchCourses() {
    setLoading(true);
    let tableName = toCourseTableName(selectedSemester);

    let query = supabase
      .from(tableName)
      .select('id, course_code, course_name, section_number, faculty_initials, credit_val', { count: 'exact' })
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order('course_code', { ascending: true })
      .order('section_number', { ascending: true });

    if (searchTerm) {
      query = query.or(`course_code.ilike.%${searchTerm}%,course_name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;

    if (!error && data) {
      setCourses(data);
    } else {
      setCourses([]);
    }
    setLoading(false);
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-4">
             <div className="p-3 bg-primary rounded-lg text-white shadow-lg shadow-sm dark:shadow-sm/20">
               <BookOpen className="w-6 h-6" />
             </div>
             Course Catalog
          </h2>
          <p className="text-muted-foreground text-[10px] font-semibold uppercase  mt-2 ml-1">Academic Repository Intelligence</p>
        </div>

        <div className="relative w-full md:w-auto">
          <select
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              setPage(0);
            }}
            className="w-full md:w-64 pl-4 pr-10 py-2.5 bg-background border border-input text-foreground rounded-lg appearance-none font-semibold text-sm focus:ring-2 focus:ring-ring focus:border-indigo-500 transition-all outline-none shadow-sm cursor-pointer"
          >
            {semesters.map(s => (
              <option key={s.code} value={s.code}>{s.title || s.code}</option>
            ))}
          </select>
          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-muted-foreground">
             <Calendar className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-card p-4 sm:p-5 rounded-xl border border-border shadow-sm">
        <div className="relative group">
          <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-muted-foreground">
            <Search className="h-4 w-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="block w-full pl-10 pr-4 py-2.5 bg-background border border-input rounded-lg text-sm font-medium text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:border-indigo-500 transition-all outline-none shadow-sm"
            placeholder="Search course code or title..."
          />
        </div>
      </div>

      {/* Courses Table */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full">
            <thead className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border">
              <tr>
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Course Code</th>
                <th className="px-6 sm:px-8 py-5 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Title & Information</th>
                <th className="hidden sm:table-cell px-8 py-5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Section</th>
                <th className="hidden lg:table-cell px-8 py-5 text-center text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Credits</th>
                <th className="px-6 sm:px-8 py-5 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Faculty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-white/5">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-8 py-6"><Skeleton className="w-32 h-8 rounded-xl" /></td>
                    <td className="px-8 py-6"><Skeleton className="w-64 h-8 rounded-xl" /></td>
                    <td className="hidden sm:table-cell px-8 py-6"><Skeleton className="w-16 h-8 rounded-xl mx-auto" /></td>
                    <td className="hidden lg:table-cell px-8 py-6"><Skeleton className="w-16 h-8 rounded-xl mx-auto" /></td>
                    <td className="px-8 py-6"><Skeleton className="w-24 h-8 rounded-xl ml-auto" /></td>
                  </tr>
                ))
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-24 text-center">
                    <div className="w-20 h-20 bg-muted rounded-3xl flex items-center justify-center mx-auto mb-6">
                       <Search className="w-10 h-10 text-slate-200 dark:text-slate-700" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground">No Courses Found</h3>
                    <p className="text-muted-foreground text-sm font-medium mt-2">Try scanning a different semester or adjusting your search.</p>
                  </td>
                </tr>
              ) : (
                courses.map((course, i) => (
                  <motion.tr 
                    key={course.id} 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group"
                  >
                    <td className="px-6 sm:px-8 py-6">
                      <div className="text-sm font-semibold text-primary dark:text-primary tracking-tight group-hover:scale-105 transition-transform origin-left">
                        {course.course_code}
                      </div>
                    </td>
                    <td className="px-6 sm:px-8 py-6">
                      <div className="text-sm font-semibold text-foreground line-clamp-1">{course.course_name || 'N/A'}</div>
                      <div className="sm:hidden flex items-center gap-2 mt-1">
                        <span className="text-[9px] font-semibold text-primary dark:text-primary uppercase">Sec {course.section_number}</span>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">•</span>
                        <span className="text-[9px] font-semibold text-muted-foreground uppercase">{course.credit_val} Credits</span>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-8 py-6 text-center">
                      <span className="px-3 py-1 bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary rounded-lg text-[10px] font-semibold border border-primary/20 dark:border-primary/20">
                        {course.section_number}
                      </span>
                    </td>
                    <td className="hidden lg:table-cell px-8 py-6 text-center">
                      <div className="text-sm font-semibold text-foreground">{course.credit_val ? `${course.credit_val}` : 'N/A'}</div>
                    </td>
                    <td className="px-6 sm:px-8 py-6 text-right">
                      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background text-foreground border border-slate-100 dark:border-border font-semibold text-[10px] uppercase tracking-tighter shadow-sm">
                        <Zap className="w-3 h-3 text-primary" />
                        {course.faculty_initials || 'TBA'}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && (
          <div className="px-8 py-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-border flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Catalog Page <span className="text-foreground">{page + 1}</span> of Global Database
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-3 bg-card border border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md dark:hover:shadow-none disabled:opacity-30 transition-all"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              
              <div className="px-6 py-3 bg-card border border-border rounded-lg text-xs font-semibold text-foreground shadow-sm">
                {page + 1}
              </div>

              <button
                onClick={() => setPage(p => p + 1)}
                disabled={courses.length < pageSize}
                className="p-3 bg-card border border-border rounded-lg text-muted-foreground hover:bg-accent hover:text-accent-foreground hover:shadow-md dark:hover:shadow-none disabled:opacity-30 transition-all"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
