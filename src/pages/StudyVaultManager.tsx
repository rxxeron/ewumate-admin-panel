import { useConfirm } from '../components/ConfirmProvider';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Library, 
  Check, 
  X, 
  FileText, 
  Trash2, 
  Search, 
  User, 
  Clock, 
  RefreshCw, 
  Eye, 
  FileCode, 
  Image, 
  Layers,
  HardDrive,
  CheckCheck,
  CheckSquare,
  Square,
  ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import type { StudyMaterial, DriveAccount } from '../types';


const FILE_TYPES = [
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
];

export function StudyVaultManager() {
  const confirmAction = useConfirm();
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedSemester, setSelectedSemester] = useState<string>('all');
  const [selectedFileType, setSelectedFileType] = useState<string>('all');
  const [semesters, setSemesters] = useState<string[]>([]);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [previewMaterial, setPreviewMaterial] = useState<StudyMaterial | null>(null);

  // Storage Pools state variables
  const [driveAccounts, setDriveAccounts] = useState<DriveAccount[]>([]);
  const [loadingDriveAccounts, setLoadingDriveAccounts] = useState(true);

  // Fetch unique semesters for filter
  useEffect(() => {
    fetchSemesters();
    fetchMaterials();
    fetchDriveAccounts();

    const channel = supabase
      .channel('study_vault_realtime_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_materials' }, () => {
        fetchMaterials(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchDriveAccounts() {
    setLoadingDriveAccounts(true);
    try {
      const { data, error } = await supabase
        .from('drive_accounts')
        .select('id, email, total_capacity_bytes, used_bytes, is_active, created_at, folder_id, purpose')
        .order('email', { ascending: true });

      if (error) throw error;
      setDriveAccounts(data || []);
    } catch (err: any) {
      console.error('Error fetching drive accounts:', err);
      toast.error('Failed to load storage drive accounts.');
    } finally {
      setLoadingDriveAccounts(false);
    }
  }

  async function toggleDriveAccountActive(accountId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('drive_accounts')
        .update({ is_active: !currentStatus })
        .eq('id', accountId);

      if (error) throw error;
      setDriveAccounts(prev => prev.map(acc => acc.id === accountId ? { ...acc, is_active: !currentStatus } : acc));
      toast.success(`Drive account ${!currentStatus ? 'activated' : 'deactivated'} successfully.`);
    } catch (err: any) {
      console.error('Error toggling drive account status:', err);
      toast.error('Failed to update drive account status.');
    }
  }

  async function handleRecalculateQuota() {
    setLoadingDriveAccounts(true);
    try {
      const { error } = await supabase.rpc('recalculate_drive_storage_used');
      if (error) throw error;
      await fetchDriveAccounts();
      toast.success('Storage quotas synchronized with active database materials.');
    } catch (err: any) {
      console.error('Recalculate quota failed:', err);
      toast.error(err.message || 'Failed to recalculate quota');
    } finally {
      setLoadingDriveAccounts(false);
    }
  }

  async function fetchSemesters() {
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select('semester');
      if (error) throw error;
      if (data) {
        const unique = Array.from(new Set(data.map(d => d.semester).filter(Boolean))) as string[];
        setSemesters(unique.sort());
      }
    } catch (err) {
      console.error('Error fetching semesters:', err);
    }
  }

  async function fetchMaterials(silent = false) {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('study_materials')
        .select(`
          *,
          profiles:uploader_id(full_name, student_id)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMaterials(data || []);
    } catch (err: any) {
      console.error('Error fetching materials:', err);
      toast.error('Failed to load study vault materials.');
    } finally {
      if (!silent) setLoading(false);
    }
  }

  // Format file size nicely
  function formatBytes(bytes: number, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  function getFileIcon(fileName: string) {
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toLowerCase() : '';
    if (ext === 'pdf') {
      return <FileText className="w-8 h-8 text-rose-500" />;
    } else if (['doc', 'docx'].includes(ext || '')) {
      return <FileText className="w-8 h-8 text-primary" />;
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(ext || '')) {
      return <Image className="w-8 h-8 text-primary" />;
    } else if (['py', 'js', 'ts', 'java', 'cpp', 'c', 'html', 'css', 'dart', 'dart.txt'].includes(ext || '')) {
      return <FileCode className="w-8 h-8 text-primary" />;
    }
    return <Layers className="w-8 h-8 text-primary" />;
  }

  // Handle document type update
  async function handleUpdateFileType(id: string, newType: string) {
    setSubmittingId(id);
    try {
      const { error } = await supabase
        .from('study_materials')
        .update({ file_type: newType, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setMaterials(prev => prev.map(m => m.id === id ? { ...m, file_type: newType, updated_at: new Date().toISOString() } : m));
      toast.success('Document type updated successfully');
    } catch (err: any) {
      console.error('Error updating type:', err);
      toast.error('Failed to update document type.');
    } finally {
      setSubmittingId(null);
    }
  }

  // Helper: Dispatches consolidated notifications grouped by student/uploader
  async function sendConsolidatedNotifications(
    actions: Array<{ uploaderId: string; fileName: string; status: 'approved' | 'rejected' }>
  ) {
    if (actions.length === 0) return;

    // Group items by uploaderId
    const userGroups = new Map<string, { approved: string[]; rejected: string[] }>();
    for (const act of actions) {
      if (!act.uploaderId) continue;
      if (!userGroups.has(act.uploaderId)) {
        userGroups.set(act.uploaderId, { approved: [], rejected: [] });
      }
      const g = userGroups.get(act.uploaderId)!;
      if (act.status === 'approved') {
        g.approved.push(act.fileName);
      } else if (act.status === 'rejected') {
        g.rejected.push(act.fileName);
      }
    }

    const notificationsToInsert: any[] = [];
    const nowIso = new Date().toISOString();

    for (const [userId, group] of userGroups.entries()) {
      const hasApproved = group.approved.length > 0;
      const hasRejected = group.rejected.length > 0;

      let title = 'Study Vault Submission Update';
      let body = '';

      if (hasApproved && !hasRejected) {
        if (group.approved.length === 1) {
          title = 'Study Material Approved!';
          body = `Your uploaded study material "${group.approved[0]}" has been approved and is now active in the vault.`;
        } else {
          title = `${group.approved.length} Study Materials Approved!`;
          body = `The following ${group.approved.length} study materials were approved and are now active: ${group.approved.slice(0, 3).map(f => `"${f}"`).join(', ')}${group.approved.length > 3 ? ` and ${group.approved.length - 3} more` : ''}.`;
        }
      } else if (!hasApproved && hasRejected) {
        if (group.rejected.length === 1) {
          title = 'Study Material Rejected';
          body = `Your uploaded study material "${group.rejected[0]}" was reviewed and rejected.`;
        } else {
          title = `${group.rejected.length} Study Materials Rejected`;
          body = `The following ${group.rejected.length} study materials were rejected: ${group.rejected.slice(0, 3).map(f => `"${f}"`).join(', ')}${group.rejected.length > 3 ? ` and ${group.rejected.length - 3} more` : ''}.`;
        }
      } else if (hasApproved && hasRejected) {
        title = 'Study Vault Review Update';
        body = `Accepted (${group.approved.length}): ${group.approved.slice(0, 2).map(f => `"${f}"`).join(', ')}${group.approved.length > 2 ? ` +${group.approved.length - 2}` : ''} | Rejected (${group.rejected.length}): ${group.rejected.slice(0, 2).map(f => `"${f}"`).join(', ')}${group.rejected.length > 2 ? ` +${group.rejected.length - 2}` : ''}.`;
      }

      if (body) {
        notificationsToInsert.push({
          user_id: userId,
          title,
          body,
          type: 'push_alert',
          alert_key: `vault_batch_${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          is_dispatched: false,
          trigger_at: nowIso,
        });
      }
    }

    if (notificationsToInsert.length > 0) {
      try {
        await supabase.from('notifications').insert(notificationsToInsert);
      } catch (notifyErr) {
        console.error('Failed to insert consolidated notifications:', notifyErr);
      }
    }
  }

  // Handle single status update
  async function handleUpdateStatus(id: string, newStatus: 'approved' | 'rejected' | 'removal_requested' | 'pending') {
    setSubmittingId(id);
    try {
      const { error } = await supabase
        .from('study_materials')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      // Notify uploader if approved or rejected
      const mat = materials.find(m => m.id === id);
      if (mat && mat.uploader_id && (newStatus === 'approved' || newStatus === 'rejected')) {
        await sendConsolidatedNotifications([{
          uploaderId: mat.uploader_id,
          fileName: mat.file_name,
          status: newStatus
        }]);
      }

      setMaterials(prev => prev.map(m => m.id === id ? { ...m, status: newStatus, updated_at: new Date().toISOString() } : m));
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      toast.success(`Material status set to ${newStatus.replace('_', ' ').toUpperCase()}`);
    } catch (err: any) {
      console.error('Error updating status:', err);
      toast.error('Failed to update status.');
    } finally {
      setSubmittingId(null);
    }
  }

  // Handle Batch Approval (either targeted IDs or all pending)
  async function handleBatchApprove(targetIds?: string[]) {
    const idsToApprove = targetIds ?? Array.from(selectedIds);
    if (idsToApprove.length === 0) {
      toast.error('No items selected for approval.');
      return;
    }

    const confirmMsg = `Are you sure you want to approve ${idsToApprove.length} study material${idsToApprove.length > 1 ? 's' : ''}? Students will receive a consolidated notification.`;
    if (!await confirmAction(confirmMsg)) return;

    setBatchProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('study_materials')
        .update({ status: 'approved', updated_at: nowIso })
        .in('id', idsToApprove);

      if (error) throw error;

      // Prepare consolidated notification payload
      const notificationActions = materials
        .filter(m => idsToApprove.includes(m.id) && m.uploader_id)
        .map(m => ({
          uploaderId: m.uploader_id!,
          fileName: m.file_name,
          status: 'approved' as const
        }));

      await sendConsolidatedNotifications(notificationActions);

      setMaterials(prev => prev.map(m => idsToApprove.includes(m.id) ? { ...m, status: 'approved', updated_at: nowIso } : m));
      setSelectedIds(prev => {
        const next = new Set(prev);
        idsToApprove.forEach(id => next.delete(id));
        return next;
      });

      toast.success(`Successfully approved ${idsToApprove.length} material${idsToApprove.length > 1 ? 's' : ''}!`);
    } catch (err: any) {
      console.error('Batch approval error:', err);
      toast.error('Failed to approve materials in batch.');
    } finally {
      setBatchProcessing(false);
    }
  }

  // Handle Batch Rejection
  async function handleBatchReject(targetIds?: string[]) {
    const idsToReject = targetIds ?? Array.from(selectedIds);
    if (idsToReject.length === 0) {
      toast.error('No items selected for rejection.');
      return;
    }

    const confirmMsg = `Are you sure you want to reject ${idsToReject.length} study material${idsToReject.length > 1 ? 's' : ''}? Students will receive a consolidated notification.`;
    if (!await confirmAction(confirmMsg)) return;

    setBatchProcessing(true);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('study_materials')
        .update({ status: 'rejected', updated_at: nowIso })
        .in('id', idsToReject);

      if (error) throw error;

      // Prepare consolidated notification payload
      const notificationActions = materials
        .filter(m => idsToReject.includes(m.id) && m.uploader_id)
        .map(m => ({
          uploaderId: m.uploader_id!,
          fileName: m.file_name,
          status: 'rejected' as const
        }));

      await sendConsolidatedNotifications(notificationActions);

      setMaterials(prev => prev.map(m => idsToReject.includes(m.id) ? { ...m, status: 'rejected', updated_at: nowIso } : m));
      setSelectedIds(prev => {
        const next = new Set(prev);
        idsToReject.forEach(id => next.delete(id));
        return next;
      });

      toast.success(`Successfully rejected ${idsToReject.length} material${idsToReject.length > 1 ? 's' : ''}.`);
    } catch (err: any) {
      console.error('Batch rejection error:', err);
      toast.error('Failed to reject materials in batch.');
    } finally {
      setBatchProcessing(false);
    }
  }

  // Toggle selection for a single row
  function toggleSelectRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // Select all or deselect all visible items
  function toggleSelectAll(currentVisibleIds: string[]) {
    setSelectedIds(prev => {
      const allSelected = currentVisibleIds.length > 0 && currentVisibleIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        currentVisibleIds.forEach(id => next.delete(id));
      } else {
        currentVisibleIds.forEach(id => next.add(id));
      }
      return next;
    });
  }

  // Handle permanent delete or approval of removal request
  async function handleDeleteMaterial(id: string, isRemovalRequest = false) {
    const message = isRemovalRequest 
      ? 'Are you sure you want to approve this removal request? This will permanently delete the study material from the database.'
      : 'Are you sure you want to permanently delete this study material?';

    if (!await confirmAction(message)) return;

    setSubmittingId(id);
    try {
      const mat = materials.find(m => m.id === id);

      const { error } = await supabase
        .from('study_materials')
        .delete()
        .eq('id', id);

      if (error) throw error;

      // Notify the uploader that the material was deleted
      if (mat && mat.uploader_id) {
        await supabase.from('notifications').insert([{
          user_id: mat.uploader_id,
          title: 'Study Material Removed',
          body: `Your study material "${mat.file_name}" has been successfully removed from the vault system.`,
          type: 'push_alert',
          alert_key: `material_deleted_${id}_${Date.now()}`,
          is_dispatched: false,
          trigger_at: new Date().toISOString()
        }]);
      }

      setMaterials(prev => prev.filter(m => m.id !== id));
      toast.success('Material permanently deleted.');
    } catch (err: any) {
      console.error('Error deleting material:', err);
      toast.error('Failed to delete material.');
    } finally {
      setSubmittingId(null);
    }
  }

  // Helper colors for status badges
  function getStatusStyle(status: string) {
    switch (status) {
      case 'approved':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'rejected':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'removal_requested':
        return 'bg-primary/10 text-primary border-primary/20';
      case 'pending':
      default:
        return 'bg-sky-500/10 text-sky-400 border-sky-500/20';
    }
  }

  // Counts for summary metrics
  const counts = {
    total: materials.length,
    pending: materials.filter(m => m.status === 'pending').length,
    approved: materials.filter(m => m.status === 'approved').length,
    removal: materials.filter(m => m.status === 'removal_requested').length,
    rejected: materials.filter(m => m.status === 'rejected').length,
  };

  // Storage Pool Capacity Sums
  const totalCapacity = driveAccounts.reduce((sum, acc) => sum + (acc.total_capacity_bytes || 0), 0);
  const totalUsed = driveAccounts.reduce((sum, acc) => sum + (acc.used_bytes || 0), 0);
  const totalUsedPercent = totalCapacity > 0 ? (totalUsed / totalCapacity) * 100 : 0;

  // Filter materials based on controls
  const filteredMaterials = materials.filter(m => {
    const matchesSearch = 
      m.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.course_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.faculty_initial || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.profiles?.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (m.profiles?.student_id || '').toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = selectedStatus === 'all' ? true : m.status === selectedStatus;
    const matchesSemester = selectedSemester === 'all' ? true : m.semester === selectedSemester;
    const matchesFileType = selectedFileType === 'all' ? true : m.file_type === selectedFileType;

    return matchesSearch && matchesStatus && matchesSemester && matchesFileType;
  });

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Header Area */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-2">
        <div>
          <h2 className="text-3xl font-semibold text-foreground tracking-tight flex items-center gap-4">
            <div className="p-3 bg-gradient-to-tr from-indigo-600 to-indigo-500 rounded-lg text-white shadow-lg shadow-sm dark:shadow-sm/20">
              <Library className="w-6 h-6" />
            </div>
            Vault Moderation Console
          </h2>
          <p className="text-muted-foreground text-[10px] font-semibold uppercase  mt-2 ml-1">
            Review and Manage Student Uploaded Study Materials
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {counts.pending > 0 && (
            <button
              onClick={() => handleBatchApprove(materials.filter(m => m.status === 'pending').map(m => m.id))}
              disabled={batchProcessing || loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md shadow-sm/20 active:scale-95 disabled:opacity-50"
              title="Approve all currently pending submissions and notify students"
            >
              <CheckCheck className={`w-4 h-4 ${batchProcessing ? 'animate-pulse' : ''}`} />
              Approve All Pending ({counts.pending})
            </button>
          )}

          <button
            onClick={() => fetchMaterials()}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-border dark:border-border shadow-sm active:scale-95"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Registry
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: 'Total Uploaded', count: counts.total, color: 'text-primary dark:text-primary', bg: 'bg-primary/5 border-primary/20' },
          { label: 'Pending Review', count: counts.pending, color: 'text-sky-500 dark:text-sky-400', bg: 'bg-sky-500/5 border-sky-500/10', glow: counts.pending > 0 },
          { label: 'Active Materials', count: counts.approved, color: 'text-primary dark:text-primary', bg: 'bg-primary/5 border-primary/20' },
          { label: 'Removal Requests', count: counts.removal, color: 'text-primary dark:text-primary', bg: 'bg-primary/5 border-primary/20', glow: counts.removal > 0 },
          { label: 'Rejected Vault', count: counts.rejected, color: 'text-rose-500 dark:text-rose-400', bg: 'bg-rose-500/5 border-rose-500/10' }
        ].map((stat, i) => (
          <div 
            key={i} 
            className={`p-6 bg-card rounded-3xl border border-border dark:border-border shadow-sm flex flex-col relative overflow-hidden transition-all duration-300 ${
              stat.glow ? 'ring-2 ring-amber-500/40 animate-pulse shadow-sm/5' : ''
            }`}
          >
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
            <span className={`text-3xl font-semibold mt-2 tracking-tight ${stat.color}`}>{stat.count}</span>
            <div className={`absolute -right-2 -bottom-2 w-12 h-12 rounded-full ${stat.bg} pointer-events-none`} />
          </div>
        ))}
      </div>

      {/* Backend Storage Pool Overview */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl p-8 rounded-lg border border-border dark:border-border shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-semibold text-foreground tracking-tight flex items-center gap-3">
              <HardDrive className="w-5 h-5 text-primary" />
              Backend Google Drive Storage Pools
            </h3>
            <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wider mt-1">
              Active Storage Nodes & Combined Capacity Metrics
            </p>
          </div>
          <button
            onClick={fetchDriveAccounts}
            disabled={loadingDriveAccounts}
            className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-slate-200/40 dark:border-border shadow-sm active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDriveAccounts ? 'animate-spin' : ''}`} />
            Sync Storage Nodes
          </button>
          <button
            onClick={handleRecalculateQuota}
            disabled={loadingDriveAccounts}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 text-xs font-bold uppercase tracking-wider rounded-xl transition-all border border-indigo-500/30 shadow-sm active:scale-95 disabled:opacity-50"
            title="Recalculate exact disk usage across accounts based on active study materials"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDriveAccounts ? 'animate-spin' : ''}`} />
            Recalculate Quotas
          </button>
        </div>

        {/* Global Progress Bar */}
        <div className="p-6 bg-background/40 border border-border rounded-lg flex flex-col gap-4">
          <div className="flex justify-between items-end">
            <div>
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">Combined Storage Usage</span>
              <span className="text-2xl font-semibold text-foreground tracking-tight mt-1">
                {formatBytes(totalUsed)} <span className="text-xs font-normal text-muted-foreground">used of</span> {formatBytes(totalCapacity)}
              </span>
            </div>
            <span className="text-sm font-semibold text-primary dark:text-primary">
              {totalUsedPercent.toFixed(2)}% Used
            </span>
          </div>

          <div className="w-full h-3 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-600 transition-all duration-500" 
              style={{ width: `${Math.min(totalUsedPercent, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span>{driveAccounts.filter(acc => acc.is_active).length} Active Storage Nodes</span>
            <span>{formatBytes(totalCapacity - totalUsed)} Available Space</span>
          </div>
        </div>

        {/* Storage Account Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {driveAccounts.map((account) => {
            const usagePercent = account.total_capacity_bytes > 0 ? (account.used_bytes / account.total_capacity_bytes) * 100 : 0;
            return (
              <div 
                key={account.id} 
                className="p-5 bg-card border border-border rounded-xl flex flex-col gap-3 relative overflow-hidden transition-all duration-300 hover:border-border shadow-sm"
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground block truncate" title={account.email}>
                        {account.email}
                      </span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider shrink-0 ${
                        account.purpose === 'office_hours'
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : account.purpose === 'facultylist'
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                          : 'bg-primary/10 text-primary border border-primary/20'
                      }`}>
                        {account.purpose === 'office_hours' ? 'Office Hours' : account.purpose === 'facultylist' ? 'Faculty List' : 'Study Vault'}
                      </span>
                    </div>
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider block mt-1">
                      Folder ID: {account.folder_id?.slice(0, 12)}...
                    </span>
                  </div>
                  
                  {/* Status Toggle Switch Badge */}
                  <button
                    onClick={() => toggleDriveAccountActive(account.id, account.is_active)}
                    className={`px-2 py-1 rounded-md text-[9px] font-semibold uppercase tracking-wider transition-all cursor-pointer shrink-0 ${
                      account.is_active 
                        ? 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20' 
                        : 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/20'
                    }`}
                  >
                    {account.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] font-bold text-muted-foreground">
                    <span>{formatBytes(account.used_bytes)} / {formatBytes(account.total_capacity_bytes)}</span>
                    <span>{usagePercent.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${
                        usagePercent > 90 
                          ? 'bg-rose-500' 
                          : usagePercent > 70 
                          ? 'bg-primary' 
                          : 'bg-primary'
                      }`}
                      style={{ width: `${Math.min(usagePercent, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <div className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl p-6 rounded-lg border border-border dark:border-border shadow-sm space-y-6">
        
        {/* Status Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-border pb-4">
          {[
            { id: 'all', label: 'All Files', count: counts.total },
            { id: 'pending', label: 'Pending Review', count: counts.pending, style: 'text-sky-500 bg-sky-500/10' },
            { id: 'approved', label: 'Active', count: counts.approved, style: 'text-primary bg-primary/10' },
            { id: 'removal_requested', label: 'Removal Requests', count: counts.removal, style: 'text-primary bg-primary/10' },
            { id: 'rejected', label: 'Rejected', count: counts.rejected, style: 'text-rose-500 bg-rose-500/10' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all ${
                selectedStatus === tab.id
                ? 'bg-primary text-white shadow-md shadow-sm/10 scale-102'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-accent hover:text-accent-foreground'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-semibold ${
                selectedStatus === tab.id ? 'bg-white/20 text-white' : 'bg-muted text-muted-foreground'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Dropdowns & Search */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search filename, course, initials, or uploader..."
              className="block w-full pl-11 pr-4 py-3 bg-background border border-slate-100 dark:border-border rounded-lg text-sm font-semibold text-foreground placeholder:text-slate-300 dark:placeholder:text-slate-600 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-ring focus:border-indigo-500 outline-none transition-all"
            />
            <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
          </div>

          {/* Semester Selector */}
          <div className="relative">
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="block w-full px-4 py-3 bg-background border border-slate-100 dark:border-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-ring cursor-pointer appearance-none"
            >
              <option value="all">All Semesters</option>
              {semesters.map(sem => (
                <option key={sem} value={sem}>{sem.toUpperCase()}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 text-[10px] font-semibold uppercase">
              SEM
            </div>
          </div>

          {/* File Type Selector */}
          <div className="relative">
            <select
              value={selectedFileType}
              onChange={(e) => setSelectedFileType(e.target.value)}
              className="block w-full px-4 py-3 bg-background border border-slate-100 dark:border-border rounded-lg text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-ring cursor-pointer appearance-none"
            >
              <option value="all">All Document Types</option>
              {FILE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 text-[10px] font-semibold uppercase">
              TYPE
            </div>
          </div>

        </div>

      </div>

      {/* Floating Batch Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="p-4 bg-primary dark:bg-indigo-700 text-white rounded-lg shadow-xl shadow-sm/25 flex flex-wrap items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <CheckCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <span className="font-semibold text-sm">{selectedIds.size} Material{selectedIds.size > 1 ? 's' : ''} Selected</span>
              <p className="text-[11px] text-indigo-100">Perform bulk approval or rejection with a single notification to each uploader</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBatchApprove()}
              disabled={batchProcessing}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-emerald-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Approve Selected ({selectedIds.size})
            </button>

            <button
              onClick={() => handleBatchReject()}
              disabled={batchProcessing}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
              Reject Selected ({selectedIds.size})
            </button>

            <button
              onClick={() => setSelectedIds(new Set())}
              disabled={batchProcessing}
              className="px-3 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold text-xs rounded-xl transition-all"
            >
              Deselect All
            </button>
          </div>
        </div>
      )}

      {/* Main Material List Registry */}
      <div className="bg-card rounded-lg border border-border dark:border-border shadow-sm overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-24 gap-4">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
            <p className="text-muted-foreground font-semibold text-xs uppercase ">Loading Vault Repository...</p>
          </div>
        ) : filteredMaterials.length === 0 ? (
          <div className="p-20 text-center flex flex-col items-center justify-center">
            <div className="bg-background/50 w-20 h-20 rounded-3xl flex items-center justify-center mb-6">
              <Library className="h-10 w-10 text-slate-300 dark:text-slate-700" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Vault Queue Empty</h3>
            <p className="mt-2 text-slate-500 dark:text-slate-500 text-sm max-w-sm">
              No study materials found matching the active filter.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-border text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  <th className="px-4 py-5 pl-6 w-12 text-center">
                    <button
                      onClick={() => toggleSelectAll(filteredMaterials.map(m => m.id))}
                      className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-primary dark:hover:text-primary"
                      title="Select/Deselect All Visible"
                    >
                      {filteredMaterials.length > 0 && filteredMaterials.every(m => selectedIds.has(m.id)) ? (
                        <CheckSquare className="w-4 h-4 text-primary dark:text-primary" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-5">File Name & Details</th>
                  <th className="px-6 py-5">Uploader</th>
                  <th className="px-6 py-5">Subject Details</th>
                  <th className="px-6 py-5">Document Type</th>
                  <th className="px-6 py-5">Status</th>
                  <th className="px-6 py-5 pr-8 text-right">Moderation Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                <AnimatePresence>
                  {filteredMaterials.map((item, idx) => (
                    <motion.tr
                      key={item.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: Math.min(idx * 0.02, 0.3) }}
                      className={`hover:bg-slate-50/40 dark:hover:bg-white/5 transition-all group ${
                        selectedIds.has(item.id) ? 'bg-primary/10/40 dark:bg-indigo-950/20' : ''
                      }`}
                    >
                      
                      {/* Checkbox Column */}
                      <td className="px-4 py-5 pl-6 text-center">
                        <button
                          onClick={() => toggleSelectRow(item.id)}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition-all text-slate-400 hover:text-primary dark:hover:text-primary"
                        >
                          {selectedIds.has(item.id) ? (
                            <CheckSquare className="w-4 h-4 text-primary dark:text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* File Icon & Name */}
                      <td className="px-4 py-5">
                        <div className="flex items-center gap-4">
                          <div className="p-2.5 bg-background rounded-lg border border-border shrink-0 group-hover:scale-105 transition-transform duration-300">
                            {getFileIcon(item.file_name)}
                          </div>
                          <div className="min-w-0 max-w-[280px] lg:max-w-[400px]">
                            <div className="font-bold text-sm text-foreground truncate" title={item.file_name}>
                              {item.file_name}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">
                              <span>{formatBytes(item.file_size_bytes)}</span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(item.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Uploader Profile */}
                      <td className="px-6 py-5">
                        {item.profiles ? (
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 dark:bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary shrink-0">
                              {item.profiles.full_name?.charAt(0) || <User className="w-3.5 h-3.5" />}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate">
                                {item.profiles.full_name || 'Student'}
                              </div>
                              <div className="font-mono text-[9px] text-primary font-semibold tracking-wider mt-0.5">
                                {item.profiles.student_id || 'N/A'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">System</span>
                        )}
                      </td>

                      {/* Subject, Faculty & Semester */}
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="px-2 py-0.5 text-[9px] font-semibold text-primary dark:text-primary bg-primary/10 dark:bg-primary/10 rounded-md border border-primary/20 dark:border-primary/20 uppercase tracking-tighter">
                              {item.course_code || 'Unknown'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 dark:text-slate-300 bg-muted rounded-md border border-border dark:border-border uppercase">
                              {item.faculty_initial || 'TBA'}
                            </span>
                          </div>
                          <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mt-0.5">
                            {item.semester || 'N/A'}
                          </span>
                        </div>
                      </td>

                      {/* Document Type Dropdown Selector */}
                      <td className="px-6 py-5">
                        <select
                          disabled={submittingId === item.id}
                          value={item.file_type || 'Other'}
                          onChange={(e) => handleUpdateFileType(item.id, e.target.value)}
                          className="bg-background border border-border dark:border-border rounded-xl px-3 py-1.5 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-ring outline-none transition-all cursor-pointer disabled:opacity-50"
                        >
                          {FILE_TYPES.map(type => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </td>

                      {/* Status Badge */}
                      <td className="px-6 py-5">
                        <span className={`px-2.5 py-1 text-[10px] font-semibold rounded-lg border uppercase tracking-wider ${getStatusStyle(item.status)}`}>
                          {item.status.replace('_', ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-5 pr-8 text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* File Preview Popup */}
                          <button
                            type="button"
                            onClick={() => setPreviewMaterial(item)}
                            className="p-2 bg-slate-50 hover:bg-muted dark:hover:bg-white/5 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-xl border border-border dark:border-border transition-all cursor-pointer"
                            title="Open File Preview Popup"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Approval / Rejection logic based on current status */}
                          {item.status === 'pending' && (
                            <>
                              <button
                                disabled={submittingId === item.id}
                                onClick={() => handleUpdateStatus(item.id, 'approved')}
                                className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl border border-primary/20 transition-all disabled:opacity-50"
                                title="Approve File"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                disabled={submittingId === item.id}
                                onClick={() => handleUpdateStatus(item.id, 'rejected')}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 transition-all disabled:opacity-50"
                                title="Reject File"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {item.status === 'approved' && (
                            <button
                              disabled={submittingId === item.id}
                              onClick={() => handleUpdateStatus(item.id, 'rejected')}
                              className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 transition-all disabled:opacity-50"
                              title="Reject & Deactivate File"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}

                          {item.status === 'removal_requested' && (
                            <>
                              <button
                                disabled={submittingId === item.id}
                                onClick={() => handleDeleteMaterial(item.id, true)}
                                className="p-2 bg-rose-500/10 hover:bg-rose-500 text-rose-400 hover:text-white rounded-xl border border-rose-500/20 transition-all disabled:opacity-50"
                                title="Approve Removal (Deletes File)"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <button
                                disabled={submittingId === item.id}
                                onClick={() => handleUpdateStatus(item.id, 'approved')}
                                className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl border border-primary/20 transition-all disabled:opacity-50"
                                title="Reject Removal (Keep Active)"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {item.status === 'rejected' && (
                            <>
                              <button
                                disabled={submittingId === item.id}
                                onClick={() => handleUpdateStatus(item.id, 'approved')}
                                className="p-2 bg-primary/10 hover:bg-primary text-primary hover:text-white rounded-xl border border-primary/20 transition-all disabled:opacity-50"
                                title="Restore/Approve File"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                disabled={submittingId === item.id}
                                onClick={() => handleDeleteMaterial(item.id, false)}
                                className="p-2 bg-slate-100 hover:bg-rose-500 dark:bg-slate-900 dark:hover:bg-rose-600 text-rose-400 hover:text-white rounded-xl border border-border dark:border-border transition-all disabled:opacity-50"
                                title="Delete Permanently"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                        </div>
                      </td>

                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Study Material Preview Modal Lightbox */}
      {previewMaterial && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={() => setPreviewMaterial(null)}
        >
          <div 
            className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-card shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                  <Eye className="w-5 h-5" />
                </div>
                <div className="min-w-0 max-w-xl">
                  <h3 className="text-base font-bold text-foreground truncate" title={previewMaterial.file_name}>
                    {previewMaterial.file_name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {previewMaterial.course_code || 'General'} • {previewMaterial.file_type || 'Study Material'} • {previewMaterial.faculty_initial ? `Faculty: ${previewMaterial.faculty_initial} • ` : ''}{formatBytes(previewMaterial.file_size_bytes)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={`https://drive.google.com/file/d/${previewMaterial.drive_file_id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-muted border border-border transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open in Drive</span>
                </a>
                <button
                  onClick={() => setPreviewMaterial(null)}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors cursor-pointer"
                  title="Close popup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Google Drive Preview Frame */}
            <div className="flex-1 bg-black/40 p-2 min-h-[550px] flex items-center justify-center overflow-hidden">
              <iframe
                src={`https://drive.google.com/file/d/${previewMaterial.drive_file_id}/preview`}
                title="Material Preview"
                className="w-full h-[72vh] border-0 rounded-xl bg-background"
                allow="autoplay"
              />
            </div>

            {/* Modal Footer with Instant Moderation Controls */}
            <div className="px-6 py-3 border-t border-border bg-card flex items-center justify-between shrink-0">
              <span className="text-xs text-muted-foreground">
                Current Status: <strong className="uppercase text-foreground">{previewMaterial.status}</strong>
              </span>
              <div className="flex items-center gap-2">
                {previewMaterial.status === 'pending' && (
                  <>
                    <button
                      disabled={submittingId === previewMaterial.id}
                      onClick={async () => {
                        await handleUpdateStatus(previewMaterial.id, 'approved');
                        setPreviewMaterial(null);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      <Check className="w-4 h-4" /> Approve Material
                    </button>
                    <button
                      disabled={submittingId === previewMaterial.id}
                      onClick={async () => {
                        await handleUpdateStatus(previewMaterial.id, 'rejected');
                        setPreviewMaterial(null);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                    >
                      <X className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {previewMaterial.status === 'approved' && (
                  <button
                    disabled={submittingId === previewMaterial.id}
                    onClick={async () => {
                      await handleUpdateStatus(previewMaterial.id, 'rejected');
                      setPreviewMaterial(null);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-4 h-4" /> Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
