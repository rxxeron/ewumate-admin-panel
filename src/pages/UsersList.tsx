import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Download, ShieldCheck, ChevronLeft, ChevronRight, X, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { Profile } from '../types';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table } from '../components/ui/Table';
import { DepartmentSelect, ProgramSelect, StatusSelect } from '../components/ui/DatabaseDropdowns';

export function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination & Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterProg, setFilterProg] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [page, setPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const pageSize = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Reset to first page on search
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, filterDept, filterProg, filterStatus, page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (debouncedSearch.trim()) {
        const sanitized = debouncedSearch.replace(/[,()]/g, '').trim();
        query = query.or(`full_name.ilike.%${sanitized}%,student_id.ilike.%${sanitized}%`);
      }
      if (filterDept) query = query.eq('department_name', filterDept);
      if (filterProg) query = query.eq('program_code', filterProg);
      if (filterStatus) query = query.eq('onboarding_status', filterStatus);

      const from = page * pageSize;
      const to = from + pageSize - 1;
      query = query.order('created_at', { ascending: false }).range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;
      setUsers(data || []);
      if (count !== null) setTotalUsers(count);
    } catch (error: any) {
      toast.error('Failed to load users: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setDebouncedSearch('');
    setFilterDept('');
    setFilterProg('');
    setFilterStatus('');
    setPage(0);
  };

  const handleExportCSV = async () => {
    toast.loading('Preparing CSV export...', { id: 'csv-export' });
    try {
      let query = supabase.from('profiles').select('*');
      if (debouncedSearch.trim()) {
        const sanitized = debouncedSearch.replace(/[,()]/g, '').trim();
        query = query.or(`full_name.ilike.%${sanitized}%,student_id.ilike.%${sanitized}%`);
      }
      if (filterDept) query = query.eq('department_name', filterDept);
      if (filterProg) query = query.eq('program_code', filterProg);
      if (filterStatus) query = query.eq('onboarding_status', filterStatus);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No data to export', { id: 'csv-export' });
        return;
      }

      const headers = ['Student ID', 'Name', 'Program', 'Department', 'CGPA', 'Credits', 'Status', 'Joined'];
      const csvData = data.map((u) => [
        u.student_id || 'N/A',
        u.full_name || 'N/A',
        u.program_code || 'N/A',
        u.department_name || 'N/A',
        u.cgpa || 'N/A',
        u.total_credits_earned || '0',
        u.onboarding_status || 'N/A',
        new Date(u.created_at).toLocaleDateString(),
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ewumate_students_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();

      toast.success(`Exported ${data.length} student records`, { id: 'csv-export' });
    } catch (error: any) {
      toast.error('Export failed: ' + error.message, { id: 'csv-export' });
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);
  const hasActiveFilters = Boolean(searchTerm || filterDept || filterProg || filterStatus);

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">Student Directory</h2>
              <p className="text-muted-foreground text-xs font-medium mt-0.5">
                {totalUsers.toLocaleString()} registered students in database
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="text-xs text-muted-foreground">
              <X className="w-3.5 h-3.5 mr-1" /> Reset Filters
            </Button>
          )}
          <Button onClick={handleExportCSV} variant="outline" size="sm" className="w-full sm:w-auto">
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filter Controls Card with Database Dropdowns */}
      <div className="bg-card p-4 rounded-xl border border-border shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search student by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-10"
          />
        </div>

        {/* Database-Driven Department Dropdown */}
        <div>
          <DepartmentSelect
            value={filterDept}
            onChange={(e) => {
              setFilterDept(e.target.value);
              setFilterProg(''); // Reset program filter when department changes
              setPage(0);
            }}
            allLabel="All Departments"
          />
        </div>

        {/* Database-Driven Program Dropdown (auto-scoped to selected department) */}
        <div>
          <ProgramSelect
            departmentFilter={filterDept}
            value={filterProg}
            onChange={(e) => {
              setFilterProg(e.target.value);
              setPage(0);
            }}
            allLabel="All Degree Programs"
          />
        </div>

        {/* Database-Driven Onboarding Status Dropdown */}
        <div>
          <StatusSelect
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setPage(0);
            }}
            allLabel="All Statuses"
          />
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Student
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Academic Program
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Standing
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-sm text-muted-foreground">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      Loading student records...
                    </div>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground text-sm">
                    No student records matching current filters.
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr
                    key={u.id}
                    onClick={() => navigate('/users/' + u.id)}
                    className="hover:bg-muted/50 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors">
                        {u.full_name || 'Anonymous Student'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{u.student_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-foreground">{u.program_code || '—'}</div>
                      <div className="text-xs text-muted-foreground">{u.department_name || 'General'}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-foreground font-mono tabular-nums">
                        CGPA: {u.cgpa ?? '0.00'}
                      </div>
                      <div className="text-xs text-muted-foreground font-mono tabular-nums">
                        Credits: {u.total_credits_earned ?? 0}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.onboarding_status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : u.onboarding_status === 'course_history' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-sky-600 dark:text-sky-400 bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 rounded-full">
                          History In
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground font-medium">
              Showing page <span className="font-semibold text-foreground">{page + 1}</span> of{' '}
              <span className="font-semibold text-foreground">{totalPages}</span> ({totalUsers.toLocaleString()} total)
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
