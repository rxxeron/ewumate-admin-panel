import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface DepartmentOption {
  code: string;
  name: string;
}

export interface ProgramOption {
  code: string;
  name: string;
  department: string;
  track?: string;
  totalCredits?: number;
}

export interface SemesterOption {
  code: string;
  name: string;
  isActive: boolean;
  track?: string;
}

export interface FacultyOption {
  initials: string;
  name: string;
  department: string;
  designation?: string;
}

// In-memory cache across component lifecycles
let cachedDepartments: DepartmentOption[] | null = null;
let cachedPrograms: ProgramOption[] | null = null;
let cachedSemesters: SemesterOption[] | null = null;
let cachedFaculty: FacultyOption[] | null = null;
let cachedVersions: string[] | null = null;

export const LETTER_GRADES = [
  'A+', 'A', 'A-',
  'B+', 'B', 'B-',
  'C+', 'C',
  'D', 'F',
  'W', 'I', 'S', 'U'
] as const;

export const ONBOARDING_STATUSES = [
  { value: 'registered', label: 'Registered (Step 1)' },
  { value: 'course_history', label: 'Course History Uploaded (Step 2)' },
  { value: 'completed', label: 'Onboarding Completed' }
] as const;

export const SEMESTER_TRACKS = [
  { value: 'tri_semester', label: 'Tri-Semester (Standard / CSE / BBA)' },
  { value: 'bi_semester_phrm', label: 'Bi-Semester Pharmacy (PHRM)' },
  { value: 'bi_semester_llb', label: 'Bi-Semester Law (LLB)' }
] as const;

export const VAULT_FILE_TYPES = [
  'Term Paper',
  'Mid Questions',
  'Final Question',
  'Quiz Questions',
  'Course Outline',
  'Slide',
  'Sample Code',
  'Book',
  'Lab Manual',
  'Lab Report',
  'Project Report',
  'Other'
] as const;

export function useDatabaseOptions() {
  const [departments, setDepartments] = useState<DepartmentOption[]>(cachedDepartments || []);
  const [programs, setPrograms] = useState<ProgramOption[]>(cachedPrograms || []);
  const [semesters, setSemesters] = useState<SemesterOption[]>(cachedSemesters || []);
  const [faculty, setFaculty] = useState<FacultyOption[]>(cachedFaculty || []);
  const [appVersions, setAppVersions] = useState<string[]>(cachedVersions || []);
  const [loading, setLoading] = useState(
    !cachedDepartments || !cachedPrograms || !cachedSemesters
  );

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      try {
        const promises: Promise<void>[] = [];

        // 1. Programs & Departments
        if (!cachedPrograms || !cachedDepartments) {
          promises.push((async () => {
            const { data } = await supabase
              .from('programs')
              .select('program_code, name, department_name, track, total_degree_credits')
              .order('program_code', { ascending: true });

            if (data && isMounted) {
              const progs: ProgramOption[] = data.map(p => ({
                code: p.program_code,
                name: p.name || p.program_code,
                department: p.department_name || 'General',
                track: p.track,
                totalCredits: p.total_degree_credits
              }));
              cachedPrograms = progs;
              setPrograms(progs);

              const deptMap = new Map<string, string>();
              data.forEach(p => {
                if (p.department_name) {
                  deptMap.set(p.department_name, p.department_name);
                }
              });
              const depts: DepartmentOption[] = Array.from(deptMap.keys())
                .sort()
                .map(d => ({ code: d, name: d }));
              cachedDepartments = depts;
              setDepartments(depts);
            }
          })());
        }

        // 2. Semesters
        if (!cachedSemesters) {
          promises.push((async () => {
            const { data, error } = await supabase
              .from('semesters')
              .select('code, title, is_active')
              .order('created_at', { ascending: false });

            if (error) {
              console.error('Failed to load semesters:', error);
            } else if (data && isMounted) {
              let activeCode: string | null = null;
              const hasExplicitActive = data.some((s: any) => s.is_active);
              if (!hasExplicitActive) {
                const { data: activeData } = await supabase
                  .from('active_semester')
                  .select('current_semester_code')
                  .eq('track', 'tri_semester')
                  .maybeSingle();
                if (activeData?.current_semester_code) {
                  activeCode = activeData.current_semester_code.toLowerCase().replace(/[^a-z0-9]/g, '');
                }
              }

              const sems: SemesterOption[] = data.map((s: any) => {
                const normCode = (s.code || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                return {
                  code: s.code,
                  name: s.title || s.code,
                  isActive: !!s.is_active || (!!activeCode && normCode === activeCode)
                };
              });
              cachedSemesters = sems;
              setSemesters(sems);
            }
          })());
        }

        // 3. Faculty Directory
        if (!cachedFaculty) {
          promises.push((async () => {
            const { data, error } = await supabase
              .from('faculty_master')
              .select('short_name, full_name, department_name, designation_name')
              .order('short_name', { ascending: true });

            if (error) {
              console.error('Failed to load faculty:', error);
            } else if (data && isMounted) {
              const facs: FacultyOption[] = data.map((f: any) => ({
                initials: f.short_name,
                name: f.full_name || f.short_name,
                department: f.department_name || '',
                designation: f.designation_name
              }));
              cachedFaculty = facs;
              setFaculty(facs);
            }
          })());
        }

        // 4. App Versions
        if (!cachedVersions) {
          promises.push((async () => {
            const { data } = await supabase
              .from('profiles')
              .select('app_version')
              .not('app_version', 'is', null);

            if (data && isMounted) {
              const unique = Array.from(
                new Set(data.map((d: any) => d.app_version).filter(Boolean))
              ) as string[];
              unique.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
              cachedVersions = unique;
              setAppVersions(unique);
            }
          })());
        }

        await Promise.all(promises);
      } catch (err) {
        console.error('Failed to load database options:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadOptions();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    departments,
    programs,
    semesters,
    faculty,
    appVersions,
    grades: LETTER_GRADES,
    onboardingStatuses: ONBOARDING_STATUSES,
    tracks: SEMESTER_TRACKS,
    vaultFileTypes: VAULT_FILE_TYPES,
    loading
  };
}
