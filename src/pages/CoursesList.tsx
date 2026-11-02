import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BookOpen, Search, ChevronLeft, ChevronRight, Zap, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { CourseSection } from '../types';
import { Skeleton } from '../components/Skeleton';
import { toCourseTableName } from '../lib/academicUtils';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table } from '../components/ui/Table';
import { SemesterSelect } from '../components/ui/DatabaseDropdowns';
import { useDatabaseOptions } from '../hooks/useDatabaseOptions';
import { Select } from '../components/ui/Select';

export function CoursesList() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [courses, setCourses] = useState<CourseSection[]>([]);
  const { semesters, faculty } = useDatabaseOptions();
  const [selectedSemester, setSelectedSemester] = useState<string>('');
  const [selectedFaculty, setSelectedFaculty] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [totalCourses, setTotalCourses] = useState(0);

  const searchTerm = searchParams.get('q') || '';
  const page = parseInt(searchParams.get('page') || '0');
  const pageSize = 25;

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

  // Set default active semester once options load
  useEffect(() => {
    if (semesters.length > 0 && !selectedSemester) {
      const active = semesters.find(s => s.isActive);
      setSelectedSemester(active ? active.code : semesters[0].code);
    }
  }, [semesters, selectedSemester]);

  useEffect(() => {
    if (selectedSemester) {
      fetchCourses();
    }
  }, [selectedSemester, page, searchTerm, selectedFaculty]);

  async function fetchCourses() {
    setLoading(true);
    const tableName = toCourseTableName(selectedSemester);

    try {
      let query = supabase
        .from(tableName)
        .select('id, course_code, course_name, section_number, faculty_initials, credit_val', { count: 'exact' });

      if (searchTerm.trim()) {
        const sanitized = searchTerm.replace(/[,()]/g, '').trim();
        query = query.or(`course_code.ilike.%${sanitized}%,course_name.ilike.%${sanitized}%`);
      }

      if (selectedFaculty) {
        query = query.eq('faculty_initials', selectedFaculty);
      }

      query = query
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('course_code', { ascending: true })
        .order('section_number', { ascending: true });

      const { data, error, count } = await query;

      if (!error && data) {
        setCourses(data);
        if (count !== null) setTotalCourses(count);
      } else {
        setCourses([]);
        setTotalCourses(0);
      }
    } catch {
      setCourses([]);
      setTotalCourses(0);
    } finally {
      setLoading(false);
    }
  }

  const handleResetFilters = () => {
    setSearchTerm('');
    setSelectedFaculty('');
    setPage(0);
  };

  const totalPages = Math.ceil(totalCourses / pageSize);
  const hasActiveFilters = Boolean(searchTerm || selectedFaculty);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Course Catalog</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCourses.toLocaleString()} section schedules recorded for {selectedSemester || 'active term'}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <SemesterSelect
            value={selectedSemester}
            onChange={(e) => {
              setSelectedSemester(e.target.value);
              setPage(0);
            }}
          />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
            placeholder="Search by course code (e.g. CSE103) or course name..."
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={selectedFaculty}
            onChange={(e) => {
              setSelectedFaculty(e.target.value);
              setPage(0);
            }}
          >
            <option value="">All Faculty Members</option>
            {faculty.map((f) => (
              <option key={f.initials} value={f.initials}>
                {f.initials} — {f.name}
              </option>
            ))}
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="icon" onClick={handleResetFilters} title="Reset search and filters">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Course Code
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Course Title
                </th>
                <th className="px-6 py-3.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Section
                </th>
                <th className="px-6 py-3.5 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Credits
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Faculty
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4"><Skeleton className="w-24 h-5" /></td>
                    <td className="px-6 py-4"><Skeleton className="w-48 h-5" /></td>
                    <td className="px-6 py-4 text-center"><Skeleton className="w-8 h-5 mx-auto" /></td>
                    <td className="px-6 py-4 text-center"><Skeleton className="w-8 h-5 mx-auto" /></td>
                    <td className="px-6 py-4 text-right"><Skeleton className="w-16 h-5 ml-auto" /></td>
                  </tr>
                ))
              ) : courses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-muted-foreground text-sm">
                    No course sections found for the current query in table <code className="font-mono text-xs">{toCourseTableName(selectedSemester)}</code>.
                  </td>
                </tr>
              ) : (
                courses.map((course, i) => (
                  <motion.tr
                    key={course.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.01 }}
                    className="hover:bg-muted/50 transition-colors"
                  >
                    <td className="px-6 py-3.5">
                      <span className="font-mono font-semibold text-sm text-primary">
                        {course.course_code}
                      </span>
                    </td>
                    <td className="px-6 py-3.5">
                      <div className="text-sm font-medium text-foreground line-clamp-1">
                        {course.course_name || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="px-2.5 py-0.5 bg-primary/10 text-primary rounded-md text-xs font-semibold font-mono">
                        Sec {course.section_number}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      <span className="text-sm font-medium text-foreground font-mono">
                        {course.credit_val ?? 3.0}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted text-foreground border border-border text-xs font-semibold font-mono">
                        <Zap className="w-3 h-3 text-primary" />
                        {course.faculty_initials || 'TBA'}
                      </span>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="px-6 py-3.5 bg-muted/20 border-t border-border flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Page <span className="font-semibold text-foreground">{page + 1}</span> of{' '}
              <span className="font-semibold text-foreground">{totalPages}</span> ({totalCourses.toLocaleString()} sections)
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
