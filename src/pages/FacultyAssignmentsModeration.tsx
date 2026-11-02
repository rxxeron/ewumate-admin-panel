import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, RefreshCw, AlertCircle, Image as ImageIcon, ExternalLink, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface FacultySubmission {
  id: string;
  user_id: string;
  submission_type: 'ENROLLED' | 'BULK' | 'MULTI';
  semester: string;
  faculty_initial: string | null;
  faculty_full_name: string | null;
  assignments: Array<{
    course_code: string;
    section_number: string;
    session_type?: string;
    faculty_initial?: string;
    faculty_full_name?: string;
    faculty_designation?: string;
  }>;
  screenshot_url: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  admin_notes: string | null;
  created_at: string;
}

export function FacultyAssignmentsModeration() {
  const [submissions, setSubmissions] = useState<FacultySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedScreenshot, setSelectedScreenshot] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  async function fetchSubmissions() {
    setLoading(true);
    try {
      let query = supabase.from('faculty_assignment_submissions').select('*').order('created_at', { ascending: false });
      if (filter !== 'ALL') {
        query = query.eq('status', filter);
      }
      const { data, error } = await query;
      if (error) throw error;
      setSubmissions(data || []);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      const { data, error } = await supabase.rpc('approve_faculty_assignment_submission', {
        submission_id: id,
        notes: 'Approved via Admin Panel',
      });
      if (error) throw error;
      toast.success('Submission approved and database updated!');
      fetchSubmissions();
    } catch (err: any) {
      toast.error(`Approval error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    const notes = rejectionNotes[id] || 'Proof screenshot invalid or unreadable';
    setProcessingId(id);
    try {
      const { error } = await supabase
        .from('faculty_assignment_submissions')
        .update({ status: 'REJECTED', admin_notes: notes, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      toast.success('Submission rejected.');
      fetchSubmissions();
    } catch (err: any) {
      toast.error(`Rejection error: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-card p-6 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Faculty Course Assignment Proofs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Review crowd-sourced faculty assignment requests submitted by students with screenshot proof.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fetchSubmissions()}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-xl">
            {(['PENDING', 'APPROVED', 'REJECTED', 'ALL'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                  filter === status
                    ? 'bg-card text-primary dark:text-primary shadow-sm'
                    : 'text-muted-foreground hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="p-12 text-center text-slate-500">Loading submissions...</div>
      ) : submissions.length === 0 ? (
        <div className="p-12 text-center bg-card rounded-lg border border-slate-200 dark:border-slate-700">
          <AlertCircle className="w-10 h-10 text-slate-400 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No submissions found for filter "{filter}"</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {submissions.map((sub) => (
            <div
              key={sub.id}
              className="bg-card rounded-lg p-6 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <span
                      className={`text-[10px] font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        sub.submission_type === 'ENROLLED'
                          ? 'bg-primary/10 text-primary dark:bg-blue-900/30 dark:text-primary'
                          : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                      }`}
                    >
                      {sub.submission_type} SUBMISSION
                    </span>
                    <h3 className="text-lg font-bold text-foreground mt-2">
                      Semester: {sub.semester}
                    </h3>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded-lg ${
                      sub.status === 'APPROVED'
                        ? 'bg-primary/10 text-primary dark:bg-emerald-900/30 dark:text-primary'
                        : sub.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
                        : 'bg-primary/10 text-primary dark:bg-amber-900/30 dark:text-primary'
                    }`}
                  >
                    {sub.status}
                  </span>
                </div>

                {sub.submission_type === 'BULK' && sub.faculty_initial && (
                  <div className="p-3 bg-background/50 rounded-xl text-sm">
                    <p className="text-muted-foreground text-xs font-medium">Assigned Faculty</p>
                    <p className="font-bold text-primary dark:text-primary">
                      {sub.faculty_initial} ({sub.faculty_full_name || 'N/A'})
                    </p>
                  </div>
                )}

                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Target Assignments</p>
                  <div className="flex flex-wrap gap-2">
                    {sub.assignments.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold rounded-lg"
                      >
                        <span>{item.course_code} Sec {item.section_number}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          (item.session_type || 'Theory').toLowerCase() === 'lab'
                            ? 'bg-primary/10 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'
                            : 'bg-primary/10 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300'
                        }`}>
                          {item.session_type || 'Theory'}
                        </span>
                        {item.faculty_initial ? <span className="font-bold text-primary dark:text-primary">→ {item.faculty_initial}</span> : ''}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => setSelectedScreenshot(sub.screenshot_url)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 dark:bg-indigo-950/40 text-primary dark:text-primary hover:bg-primary/10 rounded-xl text-xs font-bold transition"
                  >
                    <ImageIcon className="w-4 h-4" /> View Portal Proof Screenshot
                  </button>
                </div>
              </div>

              {sub.status === 'PENDING' && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                  <input
                    type="text"
                    placeholder="Rejection reason (if rejecting)..."
                    value={rejectionNotes[sub.id] || ''}
                    onChange={(e) => setRejectionNotes({ ...rejectionNotes, [sub.id]: e.target.value })}
                    className="w-full text-xs px-3 py-2 bg-background border border-slate-200 dark:border-slate-700 rounded-xl"
                  />
                  <div className="flex gap-3">
                    <button
                      disabled={processingId === sub.id}
                      onClick={() => handleApprove(sub.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" /> Approve & Update DB
                    </button>
                    <button
                      disabled={processingId === sub.id}
                      onClick={() => handleReject(sub.id)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Proof Screenshot Lightbox Modal */}
      {selectedScreenshot && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedScreenshot(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div className="flex items-center gap-2.5">
                <ImageIcon className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-base text-foreground">Faculty Assignment Proof Screenshot</h4>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedScreenshot}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-muted border border-border transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Tab
                </a>
                <button
                  onClick={() => setSelectedScreenshot(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/30 rounded-xl p-2 min-h-[400px]">
              <img
                src={selectedScreenshot}
                alt="Faculty Assignment Proof Screenshot"
                className="max-h-[72vh] w-auto object-contain mx-auto rounded-lg border border-border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
