import { useConfirm } from '../components/ConfirmProvider';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { BookOpen, GraduationCap, Award, Plus, Edit2, Trash2, X, Check, Search, CalendarClock, Database, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

type Tab = 'course_metadata' | 'scholarship_policies' | 'grade_scale' | 'active_semester';

export function AcademicData() {
  const confirmAction = useConfirm();
  const [activeTab, setActiveTab] = useState<Tab>('course_metadata');
  const [data, setData] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState<any>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isAdding, setIsAdding] = useState(false);

  useEffect(() => {
    fetchData(activeTab);
    setSearchTerm('');
  }, [activeTab]);

  async function fetchData(table: Tab) {
    setLoading(true);
    let query = supabase.from(table).select('*');
    if (table === 'course_metadata') query = query.order('code');
    if (table === 'grade_scale') query = query.order('point', { ascending: false });

    const { data: result, error } = await query;
    if (!error && result) {
      setData(result);
    }
    setLoading(false);
    setIsEditing(null);
    setIsAdding(false);
  }

  const handleEdit = (item: any) => {
    setIsEditing(item);
    setEditForm({ ...item });
  };

  const handleSave = async (table: Tab) => {
    let pkField = 'id';
    if (table === 'course_metadata') {
      pkField = 'code';
      // Normalize course code
      if (editForm.code) {
        editForm.code = editForm.code.toUpperCase().replace(/\s+/g, '');
      }
    }
    if (table === 'grade_scale') pkField = 'grade';
    if (table === 'active_semester') pkField = 'track';

    let error;

    if (isAdding) {
      const { error: insertError } = await supabase.from(table).insert([editForm]);
      error = insertError;
    } else {
      const { error: updateError } = await supabase
        .from(table)
        .update(editForm)
        .eq(pkField, isEditing[pkField]);
      error = updateError;
    }

    if (!error) {
      fetchData(activeTab);
    } else {
      toast.error(`Error saving: ${error.message}`);
    }
  };

  const handleDelete = async (item: any, table: Tab) => {
    if (!await confirmAction('Are you sure you want to delete this record?')) return;
    
    let pkField = 'id';
    if (table === 'course_metadata') pkField = 'code';
    if (table === 'grade_scale') pkField = 'grade';
    if (table === 'active_semester') pkField = 'track';

    const { error } = await supabase.from(table).delete().eq(pkField, item[pkField]);

    if (!error) {
      fetchData(activeTab);
    } else {
      toast.error(`Error deleting: ${error.message}`);
    }
  };

  const columns: Record<Tab, { key: string, label: string, type: 'text' | 'number' | 'date' | 'checkbox' }[]> = {
    course_metadata: [
      { key: 'code', label: 'Course Code', type: 'text' },
      { key: 'name', label: 'Course Name', type: 'text' },
      { key: 'credit_val', label: 'Credits', type: 'number' },
      { key: 'equivalent_code', label: 'Equivalent Code', type: 'text' }
    ],
    scholarship_policies: [
      { key: 'department_code', label: 'Dept', type: 'text' },
      { key: 'min_yearly_credits', label: 'Min Credits', type: 'number' },
      { key: 'merit_cgpa_min', label: 'Merit CGPA (Min-Max)', type: 'number' },
      { key: 'deans_cgpa_min', label: 'Deans CGPA (Min-Max)', type: 'number' },
      { key: 'medha_cgpa_min', label: 'Medha CGPA (Min-Max)', type: 'number' }
    ],
    grade_scale: [
      { key: 'grade', label: 'Grade', type: 'text' },
      { key: 'point', label: 'Points', type: 'number' },
      { key: 'min_score', label: 'Min Score (%)', type: 'number' },
      { key: 'description', label: 'Description', type: 'text' },
      { key: 'policy', label: 'Policy Profile', type: 'text' }
      ],
      active_semester: [
        { key: 'track', label: 'Track', type: 'text' },
        { key: 'current_semester_code', label: 'Current Sem', type: 'text' },
        { key: 'next_semester_code', label: 'Next Sem', type: 'text' },
        { key: 'classes_start_date', label: 'Class Start', type: 'date' },
        { key: 'classes_end_date', label: 'Class End', type: 'date' },
        { key: 'advising_start_date', label: 'Advising Start', type: 'date' },
        { key: 'advising_end_date', label: 'Advising End', type: 'date' },
        { key: 'final_exam_start', label: 'Finals Start', type: 'date' },
        { key: 'final_exam_end', label: 'Finals End', type: 'date' },
        { key: 'grade_submission_start', label: 'Grade Sub Start', type: 'date' },
        { key: 'is_advising_open', label: 'Advising Open', type: 'checkbox' },
        { key: 'is_next_semester_open', label: 'Next Semester Open', type: 'checkbox' }
      ]
    };

    const filteredData = data.filter(row =>
      Object.values(row).some(val =>
        String(val).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between gap-6 items-start md:items-center">
        <div>
          <h1 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-4">
            <div className="p-3 bg-primary rounded-lg text-white shadow-lg shadow-sm dark:shadow-none">
              <Database className="w-6 h-6" />
            </div>
            Academic Data
          </h1>
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-wider mt-2 ml-1">Central Infrastructure Management</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 items-center w-full md:w-auto">
          <div className="relative w-full sm:w-64 group">
            <Search className="w-4 h-4 text-slate-400 dark:text-slate-600 absolute left-4 top-1/2 -translate-y-1/2 group-focus-within:text-primary transition-colors" />
            <input
              type="text"
              placeholder="Filter repository..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-card border border-slate-200 dark:border-border rounded-lg text-sm font-bold text-foreground focus:ring-4 focus:ring-ring dark:focus:ring-ring focus:border-indigo-500 outline-none transition-all placeholder:text-slate-300 dark:placeholder:text-slate-700 shadow-sm"
            />
          </div>
          {activeTab === 'active_semester' && (
            <Link
              to="/active-semester"
              className="w-full sm:w-auto flex items-center justify-center gap-3 bg-slate-900 dark:bg-slate-900 text-white px-8 py-3.5 rounded-lg font-semibold text-[10px] uppercase tracking-wider hover:bg-slate-800 dark:hover:bg-slate-800 transition-all shadow-lg dark:shadow-none group border border-slate-800 dark:border-border"
            >
              <CalendarClock className="w-4 h-4 text-primary" /> Visual Track Editor
            </Link>
          )}
          <button
            onClick={() => {
              setIsAdding(true);
              setIsEditing({});
              setEditForm({});
            }}
            className="w-full sm:w-auto flex items-center justify-center gap-3 bg-primary text-white px-8 py-3.5 rounded-lg font-semibold text-[10px] uppercase tracking-wider hover:bg-primary/90 transition-all shadow-lg shadow-sm dark:shadow-none group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" /> Add Record
          </button>
        </div>
      </div>

      <div className="flex gap-2 border-b border-border overflow-x-auto custom-scrollbar no-scrollbar pb-px">
        {[
          { id: 'course_metadata', label: 'Course Metadata', icon: BookOpen },
          { id: 'grade_scale', label: 'Grade Scale', icon: GraduationCap },
          { id: 'scholarship_policies', label: 'Scholarship Policies', icon: Award },
          { id: 'active_semester', label: 'Active Semester', icon: CalendarClock }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-6 py-4 font-semibold text-[10px] uppercase tracking-wider transition-all border-b-2 whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-indigo-600 text-primary dark:text-primary bg-primary/10/30 dark:bg-primary/5' 
                : 'border-transparent text-muted-foreground hover:text-slate-900 dark:hover:text-slate-300 hover:bg-accent hover:text-accent-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden transition-colors duration-300">
        {loading ? (
          <div className="p-24 text-center">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Querying database...</p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-background/50 border-b border-border">
                <tr>
                  {columns[activeTab].map(col => (
                    <th key={col.key} className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {col.label}
                    </th>
                  ))}
                  <th className="px-8 py-5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider text-right">Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                {isAdding && (
                  <tr className="bg-primary/10/30 dark:bg-primary/5 animate-in fade-in slide-in-from-left-4">
                    {columns[activeTab].map(col => (
                      <td key={col.key} className="px-8 py-6">
                        {col.type === 'checkbox' ? (
                          <input
                            type="checkbox"
                            checked={editForm[col.key] || false}
                            onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.checked })}
                            className="w-5 h-5 rounded text-primary focus:ring-ring border-slate-300 dark:border-border cursor-pointer"
                          />
                        ) : (
                          <input
                            type={col.type}
                            value={editForm[col.key] || ''}
                            onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.value })}
                            className="w-full px-4 py-3 text-sm font-bold bg-card border border-primary/20 dark:border-border rounded-xl focus:ring-4 focus:ring-ring outline-none text-foreground placeholder:text-slate-300"
                            placeholder={col.label}
                          />
                        )}
                      </td>
                    ))}
                    <td className="px-8 py-6 text-right">
                      <div className="flex items-center justify-end gap-3">
                        <button onClick={() => handleSave(activeTab)} className="p-3 bg-primary text-white rounded-xl hover:bg-primary transition-all shadow-lg shadow-sm/20"><Check className="w-4 h-4" /></button>
                        <button onClick={() => {setIsAdding(false); setIsEditing(null);}} className="p-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all"><X className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )}

                {filteredData.map((row, i) => {
                  const isEditingRow = isEditing === row && !isAdding;
                  return (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group">
                      {columns[activeTab].map(col => (
                        <td key={col.key} className="px-8 py-6 whitespace-nowrap">
                          {isEditingRow ? (
                            col.type === 'checkbox' ? (
                              <input
                                type="checkbox"
                                checked={editForm[col.key] || false}
                                onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.checked })}
                                className="w-5 h-5 rounded text-primary focus:ring-ring border-slate-300 dark:border-border cursor-pointer"
                              />
                            ) : (
                              <input
                                type={col.type}
                                value={editForm[col.key] || ''}
                                onChange={(e) => setEditForm({ ...editForm, [col.key]: e.target.value })}
                                className="w-full px-4 py-3 text-sm font-bold bg-card border border-primary/20 dark:border-border rounded-xl focus:ring-4 focus:ring-ring outline-none text-foreground"
                              />
                            )
                          ) : (
                            <div className="text-sm font-bold text-slate-900 dark:text-slate-300 tracking-tight">
                              {col.key.includes('cgpa_min') 
                                ? <span className="bg-primary/10 dark:bg-primary/10 px-3 py-1 rounded-full text-primary dark:text-primary border border-primary/20 dark:border-primary/20 font-semibold text-xs">{row[col.key]} - {row[col.label.split(' ')[0].toLowerCase() + '_cgpa_max']}</span>
                                : (col.type === 'checkbox'
                                    ? <div 
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const updatedVal = !row[col.key];
                                          let pkField = 'id';
                                          if (activeTab === 'course_metadata') pkField = 'code';
                                          if (activeTab === 'grade_scale') pkField = 'grade';
                                          if (activeTab === 'active_semester') pkField = 'track';

                                          const { error } = await supabase
                                            .from(activeTab)
                                            .update({ [col.key]: updatedVal })
                                            .eq(pkField, row[pkField]);
                                          
                                          if (error) {
                                            toast.error(`Failed to toggle: ${error.message}`);
                                          } else {
                                            toast.success(`${col.label} toggled ${updatedVal ? 'ON' : 'OFF'}`);
                                            fetchData(activeTab);
                                          }
                                        }}
                                        className="cursor-pointer inline-block"
                                      >
                                        <span className={cn(
                                          "inline-flex items-center px-2.5 py-0.5 rounded-full text-[9px] font-semibold uppercase tracking-wider border shadow-sm transition-all hover:scale-105 active:scale-95",
                                          row[col.key]
                                            ? 'bg-primary/10 dark:bg-primary/10 text-primary dark:text-primary border-primary/20 dark:border-primary/20'
                                            : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-500/20'
                                        )}>
                                          {row[col.key] ? 'ON' : 'OFF'}
                                        </span>
                                      </div>
                                    : (col.type === 'date' && row[col.key] 
                                        ? <span className="text-muted-foreground font-medium">{new Date(row[col.key]).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                        : <span className={cn(col.key === 'code' && "font-semibold text-primary dark:text-primary")}>{row[col.key] || '—'}</span>))
                              }
                            </div>
                          )}
                        </td>
                      ))}
                      <td className="px-8 py-6 text-right">
                        {isEditingRow ? (
                          <div className="flex items-center justify-end gap-3">
                            <button onClick={() => handleSave(activeTab)} className="p-3 bg-primary text-white rounded-xl hover:bg-primary transition-all shadow-lg shadow-sm/20"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setIsEditing(null)} className="p-3 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-white/20 transition-all"><X className="w-4 h-4" /></button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleEdit(row)} className="p-2 text-muted-foreground hover:text-primary dark:hover:text-primary transition-colors"><Edit2 className="w-4 h-4" /></button>
                            <button onClick={() => handleDelete(row, activeTab)} className="p-2 text-muted-foreground hover:text-rose-600 dark:hover:text-rose-400 transition-colors"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredData.length === 0 && !isAdding && !loading && (
                   <tr>
                     <td colSpan={columns[activeTab].length + 1} className="px-8 py-24 text-center">
                        <div className="w-20 h-20 bg-background rounded-3xl flex items-center justify-center mx-auto mb-6">
                           <Database className="w-10 h-10 text-slate-200 dark:text-slate-800" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">No Matrix Entries</h3>
                        <p className="text-muted-foreground text-sm font-medium mt-2">Adjust your search or add a new record to this quadrant.</p>
                     </td>
                   </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}