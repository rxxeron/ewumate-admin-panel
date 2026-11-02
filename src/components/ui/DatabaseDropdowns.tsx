import React from 'react';
import { Select, SelectProps } from './Select';
import { useDatabaseOptions, DepartmentOption, ProgramOption, SemesterOption } from '../../hooks/useDatabaseOptions';

interface BaseDropdownProps extends Omit<SelectProps, 'children'> {
  includeAllOption?: boolean;
  allLabel?: string;
}

export function DepartmentSelect({
  includeAllOption = true,
  allLabel = 'All Departments',
  value,
  onChange,
  className,
  ...props
}: BaseDropdownProps) {
  const { departments, loading } = useDatabaseOptions();

  return (
    <Select value={value} onChange={onChange} className={className} disabled={loading} {...props}>
      {includeAllOption && <option value="">{allLabel}</option>}
      {departments.map((dept: DepartmentOption) => (
        <option key={dept.code} value={dept.code}>
          {dept.name}
        </option>
      ))}
    </Select>
  );
}

export function ProgramSelect({
  includeAllOption = true,
  allLabel = 'All Programs',
  departmentFilter,
  value,
  onChange,
  className,
  ...props
}: BaseDropdownProps & { departmentFilter?: string }) {
  const { programs, loading } = useDatabaseOptions();

  const filteredPrograms = departmentFilter
    ? programs.filter(p => p.department.toLowerCase() === departmentFilter.toLowerCase())
    : programs;

  return (
    <Select value={value} onChange={onChange} className={className} disabled={loading} {...props}>
      {includeAllOption && <option value="">{allLabel}</option>}
      {filteredPrograms.map((prog: ProgramOption) => (
        <option key={prog.code} value={prog.code}>
          {prog.code} — {prog.name}
        </option>
      ))}
    </Select>
  );
}

export function SemesterSelect({
  includeAllOption = false,
  allLabel = 'All Semesters',
  value,
  onChange,
  className,
  ...props
}: BaseDropdownProps) {
  const { semesters, loading } = useDatabaseOptions();

  return (
    <Select value={value} onChange={onChange} className={className} disabled={loading} {...props}>
      {includeAllOption && <option value="">{allLabel}</option>}
      {semesters.map((sem: SemesterOption) => (
        <option key={sem.code} value={sem.code}>
          {sem.name} {sem.isActive ? '(Active)' : ''}
        </option>
      ))}
    </Select>
  );
}

export function StatusSelect({
  includeAllOption = true,
  allLabel = 'All Onboarding Statuses',
  value,
  onChange,
  className,
  ...props
}: BaseDropdownProps) {
  const { onboardingStatuses } = useDatabaseOptions();

  return (
    <Select value={value} onChange={onChange} className={className} {...props}>
      {includeAllOption && <option value="">{allLabel}</option>}
      {onboardingStatuses.map(status => (
        <option key={status.value} value={status.value}>
          {status.label}
        </option>
      ))}
    </Select>
  );
}

export function GradeSelect({
  includeEmpty = true,
  emptyLabel = 'Select Grade',
  value,
  onChange,
  className,
  ...props
}: Omit<SelectProps, 'children'> & { includeEmpty?: boolean; emptyLabel?: string }) {
  const { grades } = useDatabaseOptions();

  return (
    <Select value={value} onChange={onChange} className={className} {...props}>
      {includeEmpty && <option value="">{emptyLabel}</option>}
      {grades.map(g => (
        <option key={g} value={g}>
          {g}
        </option>
      ))}
    </Select>
  );
}
