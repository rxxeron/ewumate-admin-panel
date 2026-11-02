/**
 * EWUmate Academic Table and String Normalization Utilities
 * Matches Flutter client CourseUtils.cleanSemester() specification:
 * Strips all spaces, hyphens, and non-alphanumeric characters, and converts to lowercase.
 */

export function cleanSemesterCode(semester: string | null | undefined): string {
  if (!semester) return '';
  return semester.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function toCourseTableName(semester: string | null | undefined): string {
  return `courses_${cleanSemesterCode(semester)}`;
}

export function toCalendarTableName(semester: string | null | undefined, isBiSemester: boolean = false): string {
  const base = `calendar_${cleanSemesterCode(semester)}`;
  return isBiSemester ? `${base}_phrm_llb` : base;
}
