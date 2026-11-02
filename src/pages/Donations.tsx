import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Heart, User, Search, RefreshCw, Eye, CheckCircle2, XCircle, X, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';

interface Donation {
  id: string;
  user_id: string;
  payment_method: string;
  transaction_id: string;
  sender_info: string;
  amount: number | null;
  screenshot_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profiles?: {
    full_name: string;
    student_id: string;
    program_code: string;
  };
}

export function Donations() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);

  useEffect(() => {
    fetchDonations();

    const channel = supabase
      .channel('donations_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => {
        fetchDonations(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDonations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('donations')
        .select(`
          *,
          profiles(full_name, student_id, program_code)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDonations(data || []);
    } catch (error: any) {
      console.error('Error fetching donations:', error);
      toast.error('Failed to fetch contributions: ' + error.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: 'pending' | 'approved' | 'rejected') => {
    try {
      const donation = donations.find(d => d.id === id);
      if (!donation) return;

      const { error } = await supabase
        .from('donations')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
        
      if (error) throw error;
      
      // Send a push alert / notification to the user about their donation verification
      let bodyText = '';
      if (newStatus === 'approved') {
        bodyText = `Your developer support contribution of ${donation.amount ? donation.amount + ' BDT' : 'money'} has been approved and verified! Thank you so much for your support! ❤️`;
      } else if (newStatus === 'rejected') {
        bodyText = `Your contribution verification with TrxID ${donation.transaction_id} could not be verified. Please check details or submit again.`;
      } else {
        bodyText = `Your contribution status has been set to pending.`;
      }

      await supabase.from('notifications').insert([{
        user_id: donation.user_id,
        title: newStatus === 'approved' ? 'Contribution Approved! 💖' : 'Contribution Status Update',
        body: bodyText,
        type: 'push_alert',
        alert_key: `donation_status_${id}_${Date.now()}`,
        is_dispatched: false,
        trigger_at: new Date().toISOString()
      }]);

      setDonations(donations.map(d => d.id === id ? { ...d, status: newStatus } : d));
      toast.success(`Contribution marked as ${newStatus.toUpperCase()}`);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status: ' + error.message);
    }
  };

  const getMonthlyTotals = () => {
    const monthlyMap: Record<string, { total: number; count: number; rawDate: Date }> = {};
    
    donations
      .filter(d => d.status === 'approved' && d.amount !== null)
      .forEach(d => {
        const date = new Date(d.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyMap[key]) {
          monthlyMap[key] = { total: 0, count: 0, rawDate: date };
        }
        monthlyMap[key].total += Number(d.amount);
        monthlyMap[key].count += 1;
      });
      
    return Object.entries(monthlyMap)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([_, val]) => {
        const monthLabel = val.rawDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
        return {
          month: monthLabel,
          total: val.total,
          count: val.count,
        };
      });
  };

  const filteredDonations = donations
    .filter(d => filter === 'all' ? true : d.status === filter)
    .filter(d => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        d.transaction_id.toLowerCase().includes(q) ||
        d.sender_info.toLowerCase().includes(q) ||
        (d.profiles?.full_name || '').toLowerCase().includes(q) ||
        (d.profiles?.student_id || '').toLowerCase().includes(q)
      );
    });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': 
        return 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20';
      case 'approved': 
        return 'bg-primary/10 text-emerald-800 border-primary/20 dark:bg-primary/10 dark:text-primary dark:border-primary/20';
      case 'rejected': 
        return 'bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20';
      default: 
        return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-slate-700 dark:text-slate-400';
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h2 className="text-3xl font-bold text-foreground tracking-tight flex items-center gap-3">
            <Heart className="w-8 h-8 text-primary fill-pink-500" />
            Developer Support Contributions
          </h2>
          <p className="text-muted-foreground mt-1">Verify and manage donations/contributions from students to support server costs.</p>
        </div>
        
        <button
          onClick={() => fetchDonations()}
          className="bg-card border border-border px-4 py-2 rounded-xl shadow-sm text-sm font-semibold hover:bg-gray-50 dark:hover:bg-white/5 flex items-center gap-2 transition-all text-foreground"
        >
          <RefreshCw className="w-4 h-4" /> Refresh
        </button>
      </div>

      {/* Monthly Summary Cards */}
      {(() => {
        const monthlyTotals = getMonthlyTotals();
        if (monthlyTotals.length === 0) return null;
        return (
          <div className="bg-card rounded-3xl p-6 border border-gray-100 dark:border-border shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Heart className="w-4 h-4 text-primary fill-pink-500 animate-pulse" />
              Monthly Contribution Support
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {monthlyTotals.map((item, idx) => (
                <div key={idx} className="bg-background/50 p-4 rounded-lg border border-border shadow-inner">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{item.month}</p>
                  <p className="text-xl font-semibold text-primary mt-1">{item.total.toLocaleString()} BDT</p>
                  <p className="text-[10px] text-muted-foreground font-semibold mt-1">From {item.count} contribution{item.count !== 1 ? 's' : ''}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="relative sm:col-span-2">
          <Search className="absolute left-4 top-3 h-4.5 w-4.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by TrxID, sender number, student name or ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 border border-border rounded-lg bg-card text-foreground placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-ring text-sm shadow-sm transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block whitespace-nowrap">Status:</label>
          <select 
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-full border border-border rounded-lg shadow-sm px-4 py-2.5 dark:bg-slate-800 dark:text-white outline-none focus:ring-2 focus:ring-ring text-sm font-bold transition-all"
          >
            <option value="all">All Contributions</option>
            <option value="pending">Pending Verification</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 gap-4">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-pink-500 border-t-transparent"></div>
          <p className="text-muted-foreground font-bold text-xs uppercase ">Synchronizing Records...</p>
        </div>
      ) : filteredDonations.length === 0 ? (
        <div className="bg-card rounded-3xl shadow-sm border border-gray-100 dark:border-border p-16 text-center">
          <div className="bg-muted w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Heart className="h-10 w-10 text-gray-300 dark:text-slate-700" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No Contributions Found</h3>
          <p className="mt-2 text-gray-500 dark:text-slate-500 text-sm max-w-xs mx-auto">No developer support contributions match your filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDonations.map((donation) => {
            const isExpanded = expandedId === donation.id;
            return (
              <div 
                key={donation.id} 
                className={`bg-card rounded-lg shadow-sm border transition-all duration-300 overflow-hidden ${
                  isExpanded 
                  ? 'border-primary/20 dark:border-primary/20 ring-1 ring-pink-50 dark:ring-pink-500/10' 
                  : 'border-gray-100 dark:border-border hover:border-primary/20 dark:hover:border-border'
                }`}
              >
                {/* Header view */}
                <div 
                  onClick={() => setExpandedId(isExpanded ? null : donation.id)}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/5 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md border ${getStatusColor(donation.status)} uppercase tracking-wider`}>
                        {donation.status}
                      </span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                        {new Date(donation.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-gray-800 dark:text-slate-200 font-bold text-base flex items-center gap-2">
                      <span className="text-primary">{donation.payment_method}</span>
                      <span className="text-gray-300 dark:text-slate-600">|</span>
                      <span className="font-bold text-primary">{donation.amount ? `${donation.amount} BDT` : 'Amount Unspecified'}</span>
                      <span className="text-gray-300 dark:text-slate-600">|</span>
                      <span className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-bold text-gray-600 dark:text-slate-400">TrxID: {donation.transaction_id}</span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <User className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-bold text-gray-600 dark:text-slate-400">{donation.profiles?.full_name || 'Anonymous'}</span>
                      <span className="text-[10px] text-muted-foreground font-mono">({donation.profiles?.student_id || 'N/A'})</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-muted text-muted-foreground transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                      ▼
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-gray-50 dark:border-border animate-in slide-in-from-top-2 duration-300 bg-slate-50/30 dark:bg-slate-900/10">
                    <div className="p-6 flex flex-col gap-6 max-w-4xl mx-auto">
                      
                      {/* Control buttons */}
                      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-muted/50 rounded-lg border border-border dark:border-border">
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Action Verification Controls</span>
                          <p className="text-xs text-muted-foreground font-medium">Accept or reject this support transaction after verifying on bank statement.</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button 
                            onClick={() => updateStatus(donation.id, 'approved')}
                            className="bg-primary hover:bg-primary text-white font-bold text-xs py-2 px-4 rounded-xl shadow flex items-center gap-1.5 transition-all"
                          >
                            <CheckCircle2 className="w-4 h-4" /> Approve
                          </button>
                          <button 
                            onClick={() => updateStatus(donation.id, 'rejected')}
                            className="bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs py-2 px-4 rounded-xl shadow flex items-center gap-1.5 transition-all"
                          >
                            <XCircle className="w-4 h-4" /> Reject
                          </button>
                          <button 
                            onClick={() => updateStatus(donation.id, 'pending')}
                            className="border border-slate-300 dark:border-border dark:text-white font-bold text-xs py-2 px-4 rounded-xl hover:bg-slate-200 dark:hover:bg-white/5 transition-all"
                          >
                            Set Pending
                          </button>
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                          <label className="text-[10px] font-semibold text-primary dark:text-primary uppercase tracking-wider block">Contribution Metadata</label>
                          <div className="bg-card p-5 rounded-lg border border-border shadow-sm divide-y divide-gray-100 dark:divide-white/5 space-y-3">
                            <div className="flex justify-between items-center pt-3 text-sm">
                              <span className="text-muted-foreground font-medium">Sender Info / Acc Name:</span>
                              <span className="font-bold dark:text-white">{donation.sender_info}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 text-sm">
                              <span className="text-muted-foreground font-medium">Payment Method:</span>
                              <span className="font-semibold text-primary">{donation.payment_method}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 text-sm">
                              <span className="text-muted-foreground font-medium">Transaction ID / Reference:</span>
                              <span className="font-mono font-bold dark:text-white">{donation.transaction_id}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 text-sm">
                              <span className="text-muted-foreground font-medium">Amount Submitted:</span>
                              <span className="font-bold text-primary">{donation.amount ? `${donation.amount} BDT` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between items-center pt-3 text-sm">
                              <span className="text-muted-foreground font-medium">Student Program:</span>
                              <span className="font-semibold text-foreground">{donation.profiles?.program_code || 'N/A'}</span>
                            </div>
                          </div>
                        </div>

                        {/* Screenshot area */}
                        <div className="flex flex-col items-center justify-center">
                          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">Screenshot Receipt</span>
                          {donation.screenshot_url && donation.screenshot_url !== 'None' ? (
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedReceipt(donation.screenshot_url);
                              }}
                              className="relative group rounded-lg overflow-hidden border border-border hover:shadow-lg transition-all block max-h-[220px] max-w-[320px] cursor-pointer"
                            >
                              <img 
                                src={donation.screenshot_url} 
                                alt="Receipt Screenshot" 
                                className="object-contain w-full h-full group-hover:scale-105 transition-transform" 
                              />
                              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1.5">
                                <Eye className="w-4 h-4" /> View Full Size
                              </div>
                            </button>
                          ) : (
                            <div className="flex flex-col items-center justify-center p-8 bg-muted/50 rounded-lg border border-dashed border-border w-full h-[180px]">
                              <span className="text-3xl mb-2">📸</span>
                              <span className="text-xs text-muted-foreground font-medium">No screenshot uploaded</span>
                            </div>
                          )}
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

      {/* Receipt Proof Lightbox Modal */}
      {selectedReceipt && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedReceipt(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl max-w-4xl max-h-[90vh] overflow-hidden p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-2 border-b border-border">
              <div className="flex items-center gap-2.5">
                <Eye className="w-5 h-5 text-primary" />
                <h4 className="font-bold text-base text-foreground">Contribution Receipt Proof</h4>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={selectedReceipt}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-muted border border-border transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Open Tab
                </a>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto flex items-center justify-center bg-black/30 rounded-xl p-2 min-h-[400px]">
              <img
                src={selectedReceipt}
                alt="Receipt Screenshot Proof"
                className="max-h-[72vh] w-auto object-contain mx-auto rounded-lg border border-border"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
