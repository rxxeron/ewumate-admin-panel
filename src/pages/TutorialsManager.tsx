import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayCircle, Plus, Pencil, Trash2, Star, StarOff, ChevronUp, ChevronDown, Eye, EyeOff, X, Save, Loader2, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tutorial {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  category: string;
  thumbnail_url: string | null;
  is_featured: boolean;
  display_order: number;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = ['Getting Started', 'Features', 'Study Vault', 'Faculty', 'Advising', 'Schedule', 'General'];

function getYoutubeVideoId(url: string): string {
  try {
    const uri = new URL(url);
    if (uri.hostname.includes('youtu.be')) return uri.pathname.slice(1);
    if (uri.searchParams.has('v')) return uri.searchParams.get('v')!;
    const parts = uri.pathname.split('/');
    const embedIdx = parts.indexOf('embed');
    if (embedIdx !== -1 && parts[embedIdx + 1]) return parts[embedIdx + 1];
  } catch {}
  return '';
}

function getThumbnail(t: Tutorial): string {
  if (t.thumbnail_url) return t.thumbnail_url;
  const vid = getYoutubeVideoId(t.youtube_url);
  return vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : '';
}

const emptyForm: Omit<Tutorial, 'id' | 'created_at'> = {
  title: '',
  description: '',
  youtube_url: '',
  category: 'General',
  thumbnail_url: '',
  is_featured: false,
  display_order: 0,
  is_active: true,
};

export function TutorialsManager() {
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Tutorial | null>(null);
  const [form, setForm] = useState<Omit<Tutorial, 'id' | 'created_at'>>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Tutorial | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const fetchTutorials = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('tutorials')
      .select('*')
      .order('display_order', { ascending: true });
    if (!error && data) setTutorials(data as Tutorial[]);
    setLoading(false);
  };

  useEffect(() => { fetchTutorials(); }, []);

  const openAdd = () => {
    setEditTarget(null);
    setForm({ ...emptyForm, display_order: tutorials.length });
    setShowModal(true);
  };

  const openEdit = (t: Tutorial) => {
    setEditTarget(t);
    setForm({
      title: t.title,
      description: t.description ?? '',
      youtube_url: t.youtube_url,
      category: t.category,
      thumbnail_url: t.thumbnail_url ?? '',
      is_featured: t.is_featured,
      display_order: t.display_order,
      is_active: t.is_active,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.youtube_url.trim()) {
      toast('Title and YouTube URL are required');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description?.trim() || null,
      youtube_url: form.youtube_url.trim(),
      category: form.category,
      thumbnail_url: form.thumbnail_url?.trim() || null,
      is_featured: form.is_featured,
      display_order: form.display_order,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    if (form.is_featured) {
      // Clear other featured flags first
      await supabase.from('tutorials').update({ is_featured: false }).eq('is_featured', true);
    }

    let error;
    if (editTarget) {
      ({ error } = await supabase.from('tutorials').update(payload).eq('id', editTarget.id));
    } else {
      ({ error } = await supabase.from('tutorials').insert(payload));
    }

    setSaving(false);
    if (error) { toast('Error: ' + error.message); return; }
    toast(editTarget ? 'Tutorial updated!' : 'Tutorial added!');
    setShowModal(false);
    fetchTutorials();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const { error } = await supabase.from('tutorials').delete().eq('id', deleteTarget.id);
    if (error) { toast('Delete failed: ' + error.message); return; }
    toast('Tutorial deleted');
    setDeleteTarget(null);
    fetchTutorials();
  };

  const toggleFeatured = async (t: Tutorial) => {
    // Clear all featured first
    await supabase.from('tutorials').update({ is_featured: false }).eq('is_featured', true);
    if (!t.is_featured) {
      await supabase.from('tutorials').update({ is_featured: true }).eq('id', t.id);
    }
    fetchTutorials();
  };

  const toggleActive = async (t: Tutorial) => {
    await supabase.from('tutorials').update({ is_active: !t.is_active }).eq('id', t.id);
    fetchTutorials();
  };

  const moveOrder = async (t: Tutorial, dir: 'up' | 'down') => {
    const sorted = [...tutorials].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex(x => x.id === t.id);
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const swap = sorted[swapIdx];
    await supabase.from('tutorials').update({ display_order: swap.display_order }).eq('id', t.id);
    await supabase.from('tutorials').update({ display_order: t.display_order }).eq('id', swap.id);
    fetchTutorials();
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-[100] bg-primary text-white px-5 py-3 rounded-lg shadow-xl text-sm font-semibold"
          >
            {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <PlayCircle className="w-5 h-5 text-purple-400" />
            </div>
            Tutorials Manager
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage tutorial videos displayed in the EWUmate app
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-purple-500/20 hover:shadow-purple-500/30"
        >
          <Plus className="w-4 h-4" />
          Add Tutorial
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: tutorials.length, color: 'text-primary' },
          { label: 'Active', value: tutorials.filter(t => t.is_active).length, color: 'text-green-400' },
          { label: 'Featured', value: tutorials.filter(t => t.is_featured).length, color: 'text-yellow-400' },
          { label: 'Categories', value: new Set(tutorials.map(t => t.category)).size, color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-card/50 border border-border rounded-lg p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.label}</p>
            <p className={`text-3xl font-semibold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card/50 border border-border rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          </div>
        ) : tutorials.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <PlayCircle className="w-12 h-12 mb-3 opacity-30" />
            <p className="font-semibold">No tutorials yet</p>
            <p className="text-sm mt-1">Click "Add Tutorial" to get started</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {['Order', 'Thumbnail', 'Title & Category', 'URL', 'Status', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {tutorials.map((t, idx) => (
                  <motion.tr
                    key={t.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`hover:bg-accent hover:text-accent-foreground transition-colors ${!t.is_active ? 'opacity-40' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveOrder(t, 'up')} disabled={idx === 0}
                          className="p-1 rounded hover:bg-accent hover:text-accent-foreground disabled:opacity-20 transition-colors">
                          <ChevronUp className="w-3 h-3 text-slate-400" />
                        </button>
                        <span className="text-xs font-bold text-muted-foreground text-center">{t.display_order}</span>
                        <button onClick={() => moveOrder(t, 'down')} disabled={idx === tutorials.length - 1}
                          className="p-1 rounded hover:bg-accent hover:text-accent-foreground disabled:opacity-20 transition-colors">
                          <ChevronDown className="w-3 h-3 text-slate-400" />
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getThumbnail(t) ? (
                        <img src={getThumbnail(t)} alt={t.title}
                          className="w-20 h-14 object-cover rounded-xl border border-slate-200 dark:border-border" />
                      ) : (
                        <div className="w-20 h-14 rounded-xl bg-muted flex items-center justify-center">
                          <PlayCircle className="w-5 h-5 text-slate-300" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <div className="flex items-start gap-2">
                        {t.is_featured && (
                          <span className="shrink-0 mt-0.5 w-2 h-2 rounded-full bg-yellow-400" title="Featured" />
                        )}
                        <div>
                          <p className="text-sm font-semibold text-foreground line-clamp-2">{t.title}</p>
                          <span className="inline-block mt-1 px-2 py-0.5 rounded-md text-[9px] font-bold tracking-wide bg-purple-100 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            {t.category}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <a href={t.youtube_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:text-primary transition-colors">
                        <ExternalLink className="w-3 h-3" />
                        YouTube
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                        t.is_active ? 'bg-green-100 dark:bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'
                      }`}>
                        {t.is_active ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => toggleFeatured(t)}
                          title={t.is_featured ? 'Unfeature' : 'Set as Featured'}
                          className={`p-1.5 rounded-lg transition-colors ${
                            t.is_featured ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-500' : 'hover:bg-accent hover:text-accent-foreground text-slate-400'
                          }`}>
                          {t.is_featured ? <Star className="w-4 h-4" /> : <StarOff className="w-4 h-4" />}
                        </button>
                        <button onClick={() => toggleActive(t)}
                          title={t.is_active ? 'Hide' : 'Show'}
                          className="p-1.5 rounded-lg hover:bg-accent hover:text-accent-foreground text-slate-400 transition-colors">
                          {t.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                        <button onClick={() => openEdit(t)}
                          className="p-1.5 rounded-lg hover:bg-primary/10 dark:hover:bg-primary/10 text-primary transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(t)}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10 text-red-500 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-card border border-slate-200 dark:border-border rounded-3xl p-8 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-foreground">
                  {editTarget ? 'Edit Tutorial' : 'Add Tutorial'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-accent hover:text-accent-foreground transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Title *</label>
                  <input
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Getting Started with EWUmate"
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-slate-200 dark:border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                </div>

                {/* YouTube URL */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">YouTube URL *</label>
                  <input
                    value={form.youtube_url}
                    onChange={e => setForm(f => ({ ...f, youtube_url: e.target.value }))}
                    placeholder="https://youtu.be/... or https://youtube.com/watch?v=..."
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-slate-200 dark:border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  />
                  {form.youtube_url && getYoutubeVideoId(form.youtube_url) && (
                    <img
                      src={`https://img.youtube.com/vi/${getYoutubeVideoId(form.youtube_url)}/hqdefault.jpg`}
                      alt="preview" className="mt-2 w-full h-32 object-cover rounded-xl"
                    />
                  )}
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Description</label>
                  <textarea
                    value={form.description ?? ''}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Short description of what this video covers..."
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl bg-muted border border-slate-200 dark:border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                  />
                </div>

                {/* Category + Order */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Category</label>
                    <select
                      value={form.category}
                      onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    >
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5">Display Order</label>
                    <input
                      type="number"
                      value={form.display_order}
                      onChange={e => setForm(f => ({ ...f, display_order: parseInt(e.target.value) || 0 }))}
                      className="w-full px-4 py-3 rounded-xl bg-muted border border-slate-200 dark:border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex gap-4">
                  {[
                    { key: 'is_featured', label: '⭐ Set as Featured', color: 'yellow' },
                    { key: 'is_active', label: '👁 Active (Visible)', color: 'green' },
                  ].map(({ key, label, color }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, [key]: !f[key as keyof typeof f] }))}
                      className={`flex-1 py-3 rounded-xl text-xs font-bold border transition-all ${
                        form[key as keyof typeof form]
                          ? color === 'yellow' ? 'bg-yellow-50 dark:bg-yellow-500/10 border-yellow-300 dark:border-yellow-500/30 text-yellow-600 dark:text-yellow-400'
                          : 'bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/30 text-green-600 dark:text-green-400'
                          : 'bg-muted border-slate-200 dark:border-border text-slate-400'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-8">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-border text-muted-foreground text-sm font-bold hover:bg-accent hover:text-accent-foreground transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-60">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editTarget ? 'Save Changes' : 'Add Tutorial'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirm Modal */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-card border border-slate-200 dark:border-border rounded-3xl p-8 w-full max-w-sm shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-500/10 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-500" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">Delete Tutorial?</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                "<strong className="text-foreground">{deleteTarget.title}</strong>" will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-border text-muted-foreground text-sm font-bold hover:bg-accent hover:text-accent-foreground transition-colors">
                  Cancel
                </button>
                <button onClick={handleDelete}
                  className="flex-1 py-3 rounded-xl bg-red-500 hover:bg-red-400 text-white text-sm font-bold transition-colors">
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
