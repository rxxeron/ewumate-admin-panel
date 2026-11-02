import { useConfirm } from '../components/ConfirmProvider';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, User } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Feedback } from '../types';

export function Feedbacks() {
  const confirmAction = useConfirm();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  useEffect(() => {
    fetchFeedbacks();

    const channel = supabase
      .channel('feedbacks_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedbacks' }, () => {
        fetchFeedbacks(true);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback_comments' }, () => {
        fetchFeedbacks(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchFeedbacks = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('feedbacks')
        .select(`
          *,
          profiles(full_name, student_id, program_code),
          comments:feedback_comments(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Sort comments within each feedback
      const sortedData = (data as any[]).map(f => ({
        ...f,
        comments: (f.comments || []).sort((a: any, b: any) => 
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        )
      }));

      setFeedbacks(sortedData);
    } catch (error) {
      console.error('Error fetching feedbacks:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      // Find the feedback to get the user_id
      const fb = feedbacks.find(f => f.id === id);
      if (!fb) return;

      const { error } = await supabase
        .from('feedbacks')
        .update({ 
          status: newStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', id);
        
      if (error) throw error;
      
      // Notify the user about the status change
      await supabase.from('notifications').insert([{
        user_id: fb.user_id,
        title: 'Feedback Status Updated',
        body: `Your feedback status has been changed to "${newStatus.replace('_', ' ').toUpperCase()}".`,
        type: 'push_alert',
        alert_key: `feedback_status_${id}_${Date.now()}`,
        is_dispatched: false,
        trigger_at: new Date().toISOString()
      }]);

      setFeedbacks(feedbacks.map(f => f.id === id ? { ...f, status: newStatus as any } : f));
      toast.success(`Status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const addComment = async (feedbackId: string, userId: string, comment: string) => {
    if (!comment.trim()) return;
    try {
      const { data: commentData, error: commentError } = await supabase
        .from('feedback_comments')
        .insert([{ feedback_id: feedbackId, comment, is_admin: true }])
        .select()
        .single();

      if (commentError) throw commentError;

      // Add notification for the user
      await supabase.from('notifications').insert([{
        user_id: userId,
        title: 'Feedback Update',
        body: `An admin commented on your feedback: "${comment.substring(0, 50)}${comment.length > 50 ? '...' : ''}"`,
        type: 'push_alert',
        alert_key: `feedback_update_${feedbackId}_${Date.now()}`,
        is_dispatched: false,
        trigger_at: new Date().toISOString()
      }]);

      setFeedbacks(feedbacks.map(f => 
        f.id === feedbackId 
          ? { ...f, comments: [...(f.comments || []), commentData] } 
          : f
      ));
      toast.success('Comment added & user notified');
    } catch (error) {
      console.error('Error adding comment:', error);
      toast.error('Failed to add comment');
    }
  };

  const updateComment = async (feedbackId: string, commentId: string, newText: string) => {
    try {
      const { error } = await supabase
        .from('feedback_comments')
        .update({ comment: newText, updated_at: new Date().toISOString() })
        .eq('id', commentId);

      if (error) throw error;

      setFeedbacks(feedbacks.map(f => 
        f.id === feedbackId 
          ? { ...f, comments: (f.comments || []).map(c => c.id === commentId ? { ...c, comment: newText } : c) } 
          : f
      ));
      toast.success('Comment updated');
    } catch (error) {
      console.error('Error updating comment:', error);
      toast.error('Failed to update comment');
    }
  };

  const deleteComment = async (feedbackId: string, commentId: string) => {
    if (!await confirmAction('Delete this comment?')) return;
    try {
      const { error } = await supabase
        .from('feedback_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      setFeedbacks(feedbacks.map(f => 
        f.id === feedbackId 
          ? { ...f, comments: (f.comments || []).filter(c => c.id !== commentId) } 
          : f
      ));
      toast.success('Comment deleted');
    } catch (error) {
      console.error('Error deleting comment:', error);
      toast.error('Failed to delete comment');
    }
  };

  const filteredFeedbacks = filter === 'all' 
    ? feedbacks 
    : feedbacks.filter(f => f.status === filter);

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
      case 'in_progress': return 'bg-primary/10 text-blue-800 border-primary/20 dark:bg-primary/10 dark:text-primary dark:border-primary/20';
      case 'resolved': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20';
      case 'ignored': return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Mail className="w-8 h-8 text-primary dark:text-primary" />
            Feedback & Issue Inbox
          </h2>
          <p className="text-muted-foreground mt-1">Manage and respond to student reports and suggestions.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Filter:</label>
          <select 
            className="border-border rounded-xl shadow-sm focus:ring-2 focus:ring-ring text-sm font-bold px-4 py-2 dark:bg-slate-800 dark:text-white outline-none transition-all"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="all">All Entries</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-muted-foreground font-bold text-xs uppercase ">Synchronizing Inbox...</p>
        </div>
      ) : filteredFeedbacks.length === 0 ? (
        <div className="bg-card rounded-3xl shadow-sm border border-gray-100 dark:border-border p-16 text-center">
          <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Mail className="h-10 w-10 text-gray-300 dark:text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-foreground">Clean Inbox</h3>
          <p className="mt-2 text-gray-500 dark:text-slate-500 text-sm max-w-xs mx-auto">No feedbacks match the current filter. Everything is up to date.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFeedbacks.map((feedback) => {
            const isExpanded = expandedId === feedback.id;
            return (
              <div 
                key={feedback.id} 
                className={`bg-card rounded-lg shadow-sm border transition-all duration-300 overflow-hidden ${
                  isExpanded 
                  ? 'border-primary/20 dark:border-primary/20 ring-1 ring-indigo-50 dark:ring-indigo-500/10' 
                  : 'border-gray-100 dark:border-border hover:border-primary/20 dark:hover:border-border'
                }`}
              >
                {/* Header / Summary (Visible always) */}
                <div 
                  onClick={() => toggleExpand(feedback.id)}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getStatusColor(feedback.status)} uppercase tracking-wider`}>
                        {feedback.status.replace('_', ' ')}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {new Date(feedback.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className={`text-gray-800 dark:text-slate-200 font-medium truncate ${isExpanded ? 'hidden' : 'block'}`}>
                      {feedback.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold text-gray-600 dark:text-slate-400">{feedback.profiles?.full_name || 'Anonymous'}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({feedback.profiles?.student_id || 'N/A'})</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Responses</p>
                      <p className="text-sm font-semibold text-primary dark:text-primary">{(feedback.comments || []).length}</p>
                    </div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>

                {/* Content / Detail (Visible when expanded) */}
                {isExpanded && (
                  <div className="border-t border-gray-50 dark:border-border animate-in slide-in-from-top-2 duration-300">
                    <div className="p-6 flex flex-col gap-8 max-w-4xl mx-auto">
                      
                      {/* Top Action Bar: Status Dropdown */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-background/50 p-4 rounded-lg border border-border">
                        <div>
                           <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">Feedback Status</label>
                           <p className="text-xs text-muted-foreground font-medium">Update the current resolution phase of this report.</p>
                        </div>
                        <select
                          value={feedback.status}
                          onChange={(e) => updateStatus(feedback.id, e.target.value)}
                          className="bg-card border border-slate-200 dark:border-border rounded-xl px-4 py-2 text-sm font-bold text-foreground focus:ring-2 focus:ring-ring outline-none transition-all cursor-pointer min-w-[160px]"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                          <option value="ignored">Ignored</option>
                        </select>
                      </div>

                      {/* Original Message Section */}
                      <div className="space-y-3">
                        <label className="text-[10px] font-semibold text-primary dark:text-primary uppercase tracking-wider block">Original Student Report</label>
                        <div className="bg-card/50 p-6 rounded-3xl border border-border shadow-sm">
                          <p className="text-gray-800 dark:text-slate-200 text-lg leading-relaxed whitespace-pre-wrap">{feedback.message}</p>
                        </div>
                      </div>

                      {/* Conversation Timeline */}
                      <div className="space-y-6">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Conversation & Resolution History</label>
                           <span className="text-[10px] font-bold text-primary bg-primary/10 dark:bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-tighter">
                            {(feedback.comments || []).length} Message{(feedback.comments || []).length !== 1 ? 's' : ''}
                           </span>
                        </div>

                        <div className="space-y-4">
                          {(feedback.comments || []).map((comment) => (
                            <div 
                              key={comment.id} 
                              className={`p-5 rounded-lg relative group transition-all border ${
                                comment.is_admin 
                                ? 'bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20 ml-8' 
                                : 'bg-background border-border mr-8'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className={`text-[10px] font-semibold uppercase tracking-wider ${comment.is_admin ? 'text-primary' : 'text-primary'}`}>
                                  {comment.is_admin ? 'Admin Response' : 'Student Message'}
                                </span>
                                <div className="flex items-center gap-3">
                                  <span className="text-[9px] text-slate-400 dark:text-slate-600 font-bold uppercase">
                                    {new Date(comment.created_at).toLocaleDateString()} • {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                  <button 
                                    onClick={() => deleteComment(feedback.id, comment.id)}
                                    className="text-[9px] text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-rose-600 font-semibold uppercase"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </div>
                              <textarea
                                defaultValue={comment.comment}
                                onBlur={(e) => {
                                  if (e.target.value !== comment.comment) {
                                    updateComment(feedback.id, comment.id, e.target.value);
                                  }
                                }}
                                className="w-full bg-transparent border-none p-0 text-sm text-gray-700 dark:text-slate-300 resize-none focus:ring-0 leading-relaxed font-medium"
                                rows={Math.max(2, comment.comment.split('\n').length)}
                              />
                            </div>
                          ))}
                          {(!feedback.comments || feedback.comments.length === 0) && (
                            <div className="py-12 text-center bg-muted/50 rounded-lg border border-dashed border-slate-200 dark:border-border">
                              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-600 uppercase ">No response history available</p>
                            </div>
                          )}
                        </div>

                        {/* Reply Box */}
                        <div className="pt-6 border-t border-border">
                          <div className="relative">
                            <textarea
                              placeholder="Type your response to the student..."
                              className="w-full h-32 bg-card border border-slate-200 dark:border-border rounded-lg p-6 text-sm focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none text-foreground transition-all shadow-sm resize-none"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  addComment(feedback.id, feedback.user_id, (e.target as HTMLTextAreaElement).value);
                                  (e.target as HTMLTextAreaElement).value = '';
                                }
                              }}
                            />
                            <div className="absolute bottom-6 right-6 pointer-events-none">
                               <p className="text-[9px] text-primary dark:text-primary font-semibold uppercase tracking-wider bg-primary/10 dark:bg-primary/10 px-3 py-1 rounded-full">
                                 Press Enter to Send
                               </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
