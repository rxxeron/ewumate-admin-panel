import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Download, ShieldCheck, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { Profile } from '../types';
import { cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Table } from '../components/ui/Table';

export function UsersList() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Pagination & Filtering State
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterDept, setFilterDept] = useState('');
  const [filterProg, setFilterProg] = useState('');
  
  const [page, setPage] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);
  const pageSize = 50;

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(0); // Reset to first page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchUsers();
  }, [debouncedSearch, filterDept, filterProg, page]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('profiles')
        .select('*', { count: 'exact' });

      if (debouncedSearch) {
        query = query.or(`full_name.ilike.%${debouncedSearch}%,student_id.ilike.%${debouncedSearch}%`);
      }
      if (filterDept) query = query.eq('department_name', filterDept);
      if (filterProg) query = query.eq('program_code', filterProg);

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

  const handleExportCSV = async () => {
    toast.loading('Preparing CSV export...', { id: 'csv-export' });
    try {
      let query = supabase.from('profiles').select('*');
      if (debouncedSearch) query = query.or(`full_name.ilike.%${debouncedSearch}%,student_id.ilike.%${debouncedSearch}%`);
      if (filterDept) query = query.eq('department_name', filterDept);
      if (filterProg) query = query.eq('program_code', filterProg);

      const { data, error } = await query;
      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('No data to export', { id: 'csv-export' });
        return;
      }

      const headers = ['Student ID', 'Name', 'Program', 'Department', 'CGPA', 'Credits', 'Joined'];
      const csvData = data.map((u) => [
        u.student_id || 'N/A',
        u.full_name || 'N/A',
        u.program_code || 'N/A',
        u.department_name || 'N/A',
        u.cgpa || 'N/A',
        u.total_credits_earned || '0',
        new Date(u.created_at).toLocaleDateString()
      ]);

      const csvContent = [
        headers.join(','),
        ...csvData.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `ewumate_users_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      
      toast.success(`Exported ${data.length} users`, { id: 'csv-export' });
    } catch (error: any) {
      toast.error('Export failed: ' + error.message, { id: 'csv-export' });
    }
  };

  const totalPages = Math.ceil(totalUsers / pageSize);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight">User Directory</h2>
          <p className="text-muted-foreground text-xs font-semibold uppercase  mt-2 ml-1">
            {totalUsers.toLocaleString()} Total Students
          </p>
        </div>
        <Button onClick={handleExportCSV} className="w-full md:w-auto">
          <Download className="w-4 h-4 mr-2" /> Export Active View
        </Button>
      </div>

      <div className="bg-card p-4 rounded-xl sm:rounded-lg border shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            type="text"
            placeholder="Search by name or ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-4">
          <Input 
            type="text"
            placeholder="Department (e.g., CSE)"
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="w-full md:w-48"
          />
          <Input 
            type="text"
            placeholder="Program (e.g., B.Sc in CSE)"
            value={filterProg}
            onChange={(e) => setFilterProg(e.target.value)}
            className="w-full md:w-48"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl sm:rounded-[2.5rem] border shadow-sm overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <Table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Academic</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Standing</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">Loading users...</td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-muted-foreground">No users found.</td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr 
                    key={u.id} 
                    onClick={() => navigate('/users/' + u.id)}
                    className="hover:bg-muted/60 cursor-pointer transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground group-hover:text-primary transition-colors">{u.full_name}</div>
                      <div className="text-xs text-primary font-mono">{u.student_id}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-foreground">{u.program_code}</div>
                      <div className="text-xs text-muted-foreground">{u.department_name}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-foreground">CGPA: {u.cgpa}</div>
                      <div className="text-xs text-muted-foreground">Credits: {u.total_credits_earned}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {u.onboarding_status === 'completed' ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
                          <ShieldCheck className="w-3.5 h-3.5" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-full">
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
          <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/10">
            <span className="text-xs text-muted-foreground font-bold">
              Page {page + 1} of {totalPages}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
