import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  Star,
  Check,
  X,
  Search,
  RefreshCw,
  User,
  ThumbsUp,
  ThumbsDown,
  Trash2,
  MessageSquare,
  Lightbulb,
  Tag,
  GraduationCap,
  Calendar,
  AlertCircle,
  Database,
  Copy,
  BarChart3,
  Award,
  BookOpen,
  ArrowUpDown,
  Filter,
  ChevronRight,
  Sparkles,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useConfirm } from '../components/ConfirmProvider';
import type { FacultyReview } from '../types';

const MIGRATION_SQL = `-- Run this in Supabase Project > SQL Editor
CREATE TABLE IF NOT EXISTS public.faculty_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    faculty_initials TEXT NOT NULL,
    faculty_name TEXT,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    course_code TEXT NOT NULL,
    semester TEXT NOT NULL DEFAULT 'Summer 2026',
    semester_code TEXT,
    grade_received TEXT,
    delivery_type TEXT NOT NULL DEFAULT 'theory',
    clarity_rating NUMERIC(3, 1) NOT NULL CHECK (clarity_rating >= 1.0 AND clarity_rating <= 5.0),
    grading_fairness NUMERIC(3, 1) NOT NULL CHECK (grading_fairness >= 1.0 AND grading_fairness <= 5.0),
    exam_alignment NUMERIC(3, 1) NOT NULL CHECK (exam_alignment >= 1.0 AND exam_alignment <= 5.0),
    office_hours_accessibility NUMERIC(3, 1) NOT NULL CHECK (office_hours_accessibility >= 1.0 AND office_hours_accessibility <= 5.0),
    attendance_strictness NUMERIC(3, 1) NOT NULL CHECK (attendance_strictness >= 1.0 AND attendance_strictness <= 5.0),
    workload_level TEXT NOT NULL DEFAULT 'manageable',
    slide_reliance TEXT NOT NULL DEFAULT 'slides_with_whiteboard',
    quiz_frequency TEXT NOT NULL DEFAULT 'bi_weekly',
    textbook_need TEXT NOT NULL DEFAULT 'supplementary',
    would_take_again BOOLEAN NOT NULL DEFAULT true,
    traits TEXT[] DEFAULT '{}',
    exam_prep_tips TEXT,
    review_note TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_rejection_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    CONSTRAINT unique_user_faculty_course UNIQUE (user_id, faculty_initials, course_code)
);

CREATE INDEX IF NOT EXISTS idx_faculty_reviews_faculty ON public.faculty_reviews(faculty_initials);
CREATE INDEX IF NOT EXISTS idx_faculty_reviews_status ON public.faculty_reviews(status);
CREATE INDEX IF NOT EXISTS idx_faculty_reviews_user ON public.faculty_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_faculty_reviews_course ON public.faculty_reviews(course_code);

ALTER TABLE public.faculty_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view approved faculty reviews" ON public.faculty_reviews;
CREATE POLICY "Public can view approved faculty reviews"
ON public.faculty_reviews FOR SELECT
USING (status = 'approved' OR auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Authenticated users can submit faculty reviews" ON public.faculty_reviews;
CREATE POLICY "Authenticated users can submit faculty reviews"
ON public.faculty_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id AND status = 'pending');

DROP POLICY IF EXISTS "Users can update own review or admins moderate" ON public.faculty_reviews;
CREATE POLICY "Users can update own review or admins moderate"
ON public.faculty_reviews FOR UPDATE
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()))
WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "Users can delete own review" ON public.faculty_reviews;
CREATE POLICY "Users can delete own review"
ON public.faculty_reviews FOR DELETE
USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.admin_users WHERE user_id = auth.uid()));
`;

export interface FacultyScorecard {
  initials: string;
  name: string;
  totalReviews: number;
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  overallRating: number;
  avgClarity: number;
  avgFairness: number;
  avgAlignment: number;
  avgOfficeHours: number;
  avgStrictness: number;
  wouldTakeAgainPct: number;
  courses: { [code: string]: { count: number; avgRating: number } };
  topTraits: string[];
  reviews: FacultyReview[];
}

export function FacultyReviewsModeration() {
  const confirmAction = useConfirm();
  const [reviews, setReviews] = useState<FacultyReview[]>([]);
  const [loading, setLoading] = useState(true);

  // Primary view tab: 'moderation' (individual reviews) vs 'overall' (faculty overall scorecards)
  const [mainTab, setMainTab] = useState<'moderation' | 'overall'>('moderation');

  // Moderation tab state
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Overall ratings tab state
  const [overallSearch, setOverallSearch] = useState('');
  const [overallSort, setOverallSort] = useState<'highest' | 'lowest' | 'reviews'>('highest');
  const [selectedDrilldownInitials, setSelectedDrilldownInitials] = useState<string | null>(null);
  const [drilldownStatusFilter, setDrilldownStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  // Rejection modal state
  const [rejectModalReview, setRejectModalReview] = useState<FacultyReview | null>(null);
  const [rejectionNote, setRejectionNote] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [tableMissing, setTableMissing] = useState(false);

  useEffect(() => {
    fetchReviews();

    const channel = supabase
      .channel('faculty_reviews_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'faculty_reviews' }, () => {
        fetchReviews(true);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchReviews(silent = false) {
    if (!silent) setLoading(true);
    try {
      const { data, error } = await supabase
        .from('faculty_reviews')
        .select(`
          *,
          profiles:user_id(full_name, student_id)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('schema cache')) {
          setTableMissing(true);
          return;
        }
        throw error;
      }
      setTableMissing(false);
      setReviews(data || []);
    } catch (err: any) {
      console.error('Error fetching faculty reviews:', err);
      toast.error('Failed to load faculty reviews: ' + (err.message || 'Unknown error'));
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function handleApprove(review: FacultyReview) {
    setSubmittingId(review.id);
    try {
      const { error } = await supabase
        .from('faculty_reviews')
        .update({
          status: 'approved',
          admin_rejection_note: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', review.id);

      if (error) throw error;

      // Send positive notification to student
      await supabase.from('notifications').insert([{
        user_id: review.user_id,
        title: 'Faculty Review Approved! 🎉',
        body: `Your review for ${review.faculty_initials} (${review.course_code}) has been approved and published to the EWUmate directory.`,
        type: 'push_alert',
        alert_key: `faculty_review_approved_${review.id}_${Date.now()}`,
        is_dispatched: false,
        trigger_at: new Date().toISOString()
      }]);

      setReviews(prev =>
        prev.map(r => r.id === review.id ? { ...r, status: 'approved', admin_rejection_note: null } : r)
      );
      toast.success('Review approved and live!');
    } catch (err: any) {
      console.error('Error approving review:', err);
      toast.error('Failed to approve review.');
    } finally {
      setSubmittingId(null);
    }
  }

  function openRejectModal(review: FacultyReview) {
    setRejectModalReview(review);
    setRejectionNote(review.admin_rejection_note || '');
  }

  async function handleConfirmReject() {
    if (!rejectModalReview) return;
    const noteTrimmed = rejectionNote.trim();
    if (!noteTrimmed) {
      toast.error('Please specify a rejection reason for the student.');
      return;
    }

    setIsRejecting(true);
    try {
      const { error } = await supabase
        .from('faculty_reviews')
        .update({
          status: 'rejected',
          admin_rejection_note: noteTrimmed,
          updated_at: new Date().toISOString()
        })
        .eq('id', rejectModalReview.id);

      if (error) throw error;

      // Dispatch rejection notification with note to the student
      await supabase.from('notifications').insert([{
        user_id: rejectModalReview.user_id,
        title: 'Faculty Review Needs Attention ⚠️',
        body: `Your review for ${rejectModalReview.faculty_initials} (${rejectModalReview.course_code}) was not approved: "${noteTrimmed}". You can edit and resubmit it in the app.`,
        type: 'push_alert',
        alert_key: `faculty_review_rejected_${rejectModalReview.id}_${Date.now()}`,
        is_dispatched: false,
        trigger_at: new Date().toISOString()
      }]);

      setReviews(prev =>
        prev.map(r => r.id === rejectModalReview.id ? {
          ...r,
          status: 'rejected',
          admin_rejection_note: noteTrimmed
        } : r)
      );

      toast.success('Review rejected & notification dispatched.');
      setRejectModalReview(null);
      setRejectionNote('');
    } catch (err: any) {
      console.error('Error rejecting review:', err);
      toast.error('Failed to reject review.');
    } finally {
      setIsRejecting(false);
    }
  }

  async function handleDelete(review: FacultyReview) {
    const ok = await confirmAction({
      title: 'Delete Review',
      description: `Are you sure you want to permanently delete this review for ${review.faculty_initials}? This action cannot be undone.`,
      confirmText: 'Delete Permanently',
      variant: 'destructive'
    });
    if (!ok) return;

    setSubmittingId(review.id);
    try {
      const { error } = await supabase
        .from('faculty_reviews')
        .delete()
        .eq('id', review.id);

      if (error) throw error;

      setReviews(prev => prev.filter(r => r.id !== review.id));
      toast.success('Review permanently deleted.');
    } catch (err: any) {
      console.error('Error deleting review:', err);
      toast.error('Failed to delete review.');
    } finally {
      setSubmittingId(null);
    }
  }

  // Filter individual reviews for moderation queue
  const filteredReviews = reviews.filter(r => {
    const matchesStatus = selectedStatus === 'all' ? true : r.status === selectedStatus;
    const query = searchTerm.toLowerCase().trim();
    if (!query) return matchesStatus;

    const matchesSearch =
      r.faculty_initials.toLowerCase().includes(query) ||
      (r.faculty_name && r.faculty_name.toLowerCase().includes(query)) ||
      r.course_code.toLowerCase().includes(query) ||
      r.semester.toLowerCase().includes(query) ||
      (r.review_note && r.review_note.toLowerCase().includes(query)) ||
      (r.exam_prep_tips && r.exam_prep_tips.toLowerCase().includes(query)) ||
      (r.profiles?.full_name && r.profiles.full_name.toLowerCase().includes(query)) ||
      (r.profiles?.student_id && r.profiles.student_id.toLowerCase().includes(query));

    return matchesStatus && matchesSearch;
  });

  const counts = {
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length,
    all: reviews.length,
  };

  // Compute Faculty Overall Scorecards from reviews
  const facultyScorecards: FacultyScorecard[] = useMemo(() => {
    const map: { [initials: string]: FacultyReview[] } = {};
    for (const r of reviews) {
      const init = r.faculty_initials.toUpperCase();
      if (!map[init]) map[init] = [];
      map[init].push(r);
    }

    return Object.entries(map).map(([initials, facReviews]) => {
      const name = facReviews.find(r => r.faculty_name)?.faculty_name || initials;
      const approved = facReviews.filter(r => r.status === 'approved');
      const pending = facReviews.filter(r => r.status === 'pending');
      const rejected = facReviews.filter(r => r.status === 'rejected');

      // Use approved reviews for calculating official scores; if none approved yet, fallback to all reviews for admin preview
      const scoringList = approved.length > 0 ? approved : facReviews;
      const n = scoringList.length;

      const calcAvg = (getter: (r: FacultyReview) => number) => {
        if (n === 0) return 0;
        return +(scoringList.reduce((acc, r) => acc + (Number(getter(r)) || 0), 0) / n).toFixed(1);
      };

      const avgClarity = calcAvg(r => r.clarity_rating);
      const avgFairness = calcAvg(r => r.grading_fairness);
      const avgAlignment = calcAvg(r => r.exam_alignment);
      const avgOfficeHours = calcAvg(r => r.office_hours_accessibility);
      const avgStrictness = calcAvg(r => r.attendance_strictness);
      const overallRating = n > 0 ? +((avgClarity + avgFairness + avgAlignment + avgOfficeHours + avgStrictness) / 5).toFixed(1) : 0;

      const wouldTakeAgainCount = scoringList.filter(r => r.would_take_again).length;
      const wouldTakeAgainPct = n > 0 ? Math.round((wouldTakeAgainCount / n) * 100) : 0;

      // Course-by-course breakdown
      const courses: { [code: string]: { count: number; avgRating: number } } = {};
      for (const r of scoringList) {
        const c = r.course_code.toUpperCase();
        if (!courses[c]) {
          const courseReviews = scoringList.filter(cr => cr.course_code.toUpperCase() === c);
          const cAvg = +(courseReviews.reduce((acc, cr) => {
            return acc + ((Number(cr.clarity_rating) + Number(cr.grading_fairness) + Number(cr.exam_alignment) + Number(cr.office_hours_accessibility) + Number(cr.attendance_strictness)) / 5);
          }, 0) / courseReviews.length).toFixed(1);
          courses[c] = { count: courseReviews.length, avgRating: cAvg };
        }
      }

      // Top traits
      const traitCount: { [t: string]: number } = {};
      for (const r of scoringList) {
        for (const t of (r.traits || [])) {
          traitCount[t] = (traitCount[t] || 0) + 1;
        }
      }
      const topTraits = Object.entries(traitCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([t]) => t);

      return {
        initials,
        name,
        totalReviews: facReviews.length,
        approvedCount: approved.length,
        pendingCount: pending.length,
        rejectedCount: rejected.length,
        overallRating,
        avgClarity,
        avgFairness,
        avgAlignment,
        avgOfficeHours,
        avgStrictness,
        wouldTakeAgainPct,
        courses,
        topTraits,
        reviews: facReviews,
      };
    }).sort((a, b) => {
      if (overallSort === 'highest') {
        return b.overallRating - a.overallRating || b.totalReviews - a.totalReviews;
      } else if (overallSort === 'lowest') {
        return a.overallRating - b.overallRating || b.totalReviews - a.totalReviews;
      } else {
        return b.totalReviews - a.totalReviews || b.overallRating - a.overallRating;
      }
    });
  }, [reviews, overallSort]);

  // Filtered faculty scorecards
  const filteredScorecards = useMemo(() => {
    const q = overallSearch.toLowerCase().trim();
    if (!q) return facultyScorecards;
    return facultyScorecards.filter(f =>
      f.initials.toLowerCase().includes(q) ||
      f.name.toLowerCase().includes(q) ||
      Object.keys(f.courses).some(c => c.toLowerCase().includes(q))
    );
  }, [facultyScorecards, overallSearch]);

  // Active drilldown faculty
  const drilldownFaculty = useMemo(() => {
    if (!selectedDrilldownInitials) return null;
    return facultyScorecards.find(f => f.initials === selectedDrilldownInitials) || null;
  }, [facultyScorecards, selectedDrilldownInitials]);

  const formatAttribute = (str: string) => {
    return str.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  // University overall stats
  const uniStats = useMemo(() => {
    const approvedReviews = reviews.filter(r => r.status === 'approved');
    const totalApproved = approvedReviews.length;
    let avgScore = 0;
    if (totalApproved > 0) {
      const sum = approvedReviews.reduce((acc, r) => {
        return acc + (Number(r.clarity_rating) + Number(r.grading_fairness) + Number(r.exam_alignment) + Number(r.office_hours_accessibility) + Number(r.attendance_strictness)) / 5;
      }, 0);
      avgScore = +(sum / totalApproved).toFixed(1);
    }
    const retakeCount = approvedReviews.filter(r => r.would_take_again).length;
    const retakePct = totalApproved > 0 ? Math.round((retakeCount / totalApproved) * 100) : 0;
    return {
      totalApproved,
      avgScore,
      retakePct,
      evaluatedFaculty: facultyScorecards.length
    };
  }, [reviews, facultyScorecards]);

  return (
    <div className="space-y-6 pb-16">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <GraduationCap className="w-7 h-7 text-primary" />
            Faculty Reviews & Academic Ratings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Moderate individual student course evaluations and analyze aggregate faculty performance metrics across EWU.
          </p>
        </div>

        <button
          onClick={() => fetchReviews()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-border bg-card hover:bg-muted/80 text-foreground transition-all shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data
        </button>
      </div>

      {/* Primary Section Switcher Tabs */}
      <div className="flex items-center gap-2 border-b border-border/60 pb-px">
        <button
          onClick={() => setMainTab('moderation')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            mainTab === 'moderation'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>Individual Reviews Moderation</span>
          {counts.pending > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
              {counts.pending} pending
            </span>
          )}
        </button>

        <button
          onClick={() => setMainTab('overall')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
            mainTab === 'overall'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Faculty Overall Ratings & Scorecards</span>
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground border border-border">
            {facultyScorecards.length} faculty
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: INDIVIDUAL REVIEWS MODERATION QUEUE                               */}
      {/* ========================================================================= */}
      {mainTab === 'moderation' && (
        <div className="space-y-6">
          {/* Filter Tabs & Search */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Status Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-muted/40 border border-border/60 rounded-xl w-full md:w-auto">
              {(['pending', 'approved', 'rejected', 'all'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setSelectedStatus(tab)}
                  className={`flex-1 md:flex-none px-3.5 py-1.5 text-xs font-semibold rounded-lg capitalize transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    selectedStatus === tab
                      ? 'bg-card text-foreground shadow-sm border border-border/80'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{tab}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    tab === 'pending' && counts.pending > 0
                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {counts[tab]}
                  </span>
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search faculty, course, notes, student ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 transition-all text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* Database Missing State */}
          {tableMissing ? (
            <div className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-4">
              <div className="flex items-start gap-3.5">
                <div className="p-3 rounded-xl bg-amber-500/20 text-amber-500 shrink-0 mt-0.5">
                  <Database className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                    Database Table Activation Needed
                    <span className="text-[11px] px-2 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 font-semibold rounded-full border border-amber-500/30">
                      PostgREST PGRST205
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    The <code className="text-amber-500 font-mono px-1 py-0.5 bg-amber-500/10 rounded">public.faculty_reviews</code> table hasn't been created in your Supabase project yet.
                  </p>
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="py-24 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-medium">Loading faculty evaluations...</p>
            </div>
          ) : filteredReviews.length === 0 ? (
            <div className="text-center py-20 bg-card/50 border border-border/60 rounded-2xl p-8">
              <AlertCircle className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">No individual reviews found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {searchTerm
                  ? 'No evaluations match your search filter.'
                  : `There are currently no reviews in "${selectedStatus}" status.`}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {filteredReviews.map(review => {
                  const avgRating = (
                    (Number(review.clarity_rating) +
                      Number(review.grading_fairness) +
                      Number(review.exam_alignment) +
                      Number(review.office_hours_accessibility) +
                      Number(review.attendance_strictness)) /
                    5
                  ).toFixed(1);

                  return (
                    <motion.div
                      key={review.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      className="bg-card border border-border/70 rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-all space-y-4"
                    >
                      {/* Card Header */}
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/40 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base">
                            {review.faculty_initials}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="text-base font-bold text-foreground">
                                {review.faculty_name || review.faculty_initials}
                              </h3>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-muted-foreground border border-border">
                                {review.course_code}
                              </span>
                              <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-sky-500/10 text-sky-500 border border-sky-500/20 uppercase">
                                {review.delivery_type}
                              </span>
                              {review.grade_received && (
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                  Grade: {review.grade_received}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3.5 h-3.5" />
                                {review.semester}
                              </span>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <User className="w-3.5 h-3.5" />
                                {review.profiles?.full_name || 'Anonymous Student'} ({review.profiles?.student_id || 'ID Hidden'})
                              </span>
                              <span>•</span>
                              <span>{new Date(review.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Status and Overall */}
                        <div className="flex items-center gap-2 self-start lg:self-center">
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold">
                            <Star className="w-3.5 h-3.5 fill-amber-500" />
                            <span>{avgRating}</span>
                            <span className="text-[10px] text-muted-foreground font-normal">/5</span>
                          </div>

                          {review.would_take_again ? (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-semibold">
                              <ThumbsUp className="w-3 h-3" />
                              <span>Would retake</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-500/10 text-rose-500 border border-rose-500/20 text-[11px] font-semibold">
                              <ThumbsDown className="w-3 h-3" />
                              <span>Wouldn't retake</span>
                            </div>
                          )}

                          <span
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider ${
                              review.status === 'approved'
                                ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                : review.status === 'rejected'
                                ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            }`}
                          >
                            {review.status}
                          </span>
                        </div>
                      </div>

                      {/* Rejection Note Warning if Rejected */}
                      {review.status === 'rejected' && review.admin_rejection_note && (
                        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-600 dark:text-rose-400 space-y-1">
                          <div className="font-bold flex items-center gap-1.5">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Admin Rejection Reason Sent to Student:
                          </div>
                          <p className="italic pl-5">"{review.admin_rejection_note}"</p>
                        </div>
                      )}

                      {/* 5 Dimensions Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 py-1">
                        {[
                          { label: 'Clarity', val: review.clarity_rating },
                          { label: 'Fairness', val: review.grading_fairness },
                          { label: 'Exam Alignment', val: review.exam_alignment },
                          { label: 'Office Hours', val: review.office_hours_accessibility },
                          { label: 'Strictness', val: review.attendance_strictness },
                        ].map(metric => (
                          <div key={metric.label} className="p-2.5 bg-muted/40 border border-border/60 rounded-xl text-center">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider block">
                              {metric.label}
                            </span>
                            <span className="text-sm font-extrabold text-foreground mt-0.5 block">
                              {Number(metric.val).toFixed(1)} <span className="text-[10px] text-muted-foreground font-normal">/5</span>
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Qualitative attributes & tags */}
                      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                        <span className="px-2.5 py-1 rounded-lg bg-muted/50 border border-border text-foreground">
                          Workload: <strong>{formatAttribute(review.workload_level)}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-muted/50 border border-border text-foreground">
                          Slides: <strong>{formatAttribute(review.slide_reliance)}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-muted/50 border border-border text-foreground">
                          Quizzes: <strong>{formatAttribute(review.quiz_frequency)}</strong>
                        </span>
                        <span className="px-2.5 py-1 rounded-lg bg-muted/50 border border-border text-foreground">
                          Textbook: <strong>{formatAttribute(review.textbook_need)}</strong>
                        </span>

                        {review.traits && review.traits.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 ml-auto">
                            {review.traits.map((t: string) => (
                              <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Exam Prep Tips */}
                      {review.exam_prep_tips && (
                        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-amber-500 flex items-center gap-1.5">
                            <Lightbulb className="w-3.5 h-3.5" />
                            Exam Preparation Advice:
                          </div>
                          <p className="text-foreground pl-5">{review.exam_prep_tips}</p>
                        </div>
                      )}

                      {/* Review Note */}
                      {review.review_note && (
                        <div className="p-3 bg-muted/30 border border-border/60 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-muted-foreground flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            General Experience Note:
                          </div>
                          <p className="text-foreground pl-5">{review.review_note}</p>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/40">
                        {review.status !== 'approved' && (
                          <button
                            onClick={() => handleApprove(review)}
                            disabled={submittingId === review.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all cursor-pointer"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Approve & Publish
                          </button>
                        )}

                        {review.status !== 'rejected' && (
                          <button
                            onClick={() => openRejectModal(review)}
                            disabled={submittingId === review.id}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 transition-all cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                            Reject with Note...
                          </button>
                        )}

                        <button
                          onClick={() => handleDelete(review)}
                          disabled={submittingId === review.id}
                          className="p-1.5 text-muted-foreground hover:text-rose-500 rounded-lg hover:bg-muted transition-all cursor-pointer"
                          title="Delete review"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: FACULTY OVERALL RATINGS & SCORECARDS                              */}
      {/* ========================================================================= */}
      {mainTab === 'overall' && (
        <div className="space-y-6">
          {/* Top KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Evaluated Faculty</span>
                <GraduationCap className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-black text-foreground">
                {uniStats.evaluatedFaculty}
              </div>
              <p className="text-[11px] text-muted-foreground">Professors with at least one evaluation</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Approved Reviews</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-emerald-500">
                {uniStats.totalApproved}
              </div>
              <p className="text-[11px] text-muted-foreground">Live reviews visible to students in app</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">University Average</span>
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              </div>
              <div className="text-2xl font-black text-amber-500 flex items-baseline gap-1">
                {uniStats.avgScore}
                <span className="text-sm text-muted-foreground font-normal">/ 5.0</span>
              </div>
              <p className="text-[11px] text-muted-foreground">Across all evaluated course sections</p>
            </div>

            <div className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm space-y-2">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-xs font-bold uppercase tracking-wider">Overall Retake %</span>
                <ThumbsUp className="w-4 h-4 text-sky-500" />
              </div>
              <div className="text-2xl font-black text-sky-500">
                {uniStats.retakePct}%
              </div>
              <p className="text-[11px] text-muted-foreground">Students willing to take again</p>
            </div>
          </div>

          {/* Search & Sort Controls */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search faculty initials, name, or course code..."
                value={overallSearch}
                onChange={e => setOverallSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 text-xs rounded-xl bg-card border border-border focus:outline-none focus:ring-2 focus:ring-primary/40 text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div className="flex items-center gap-2.5 w-full md:w-auto justify-end">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ArrowUpDown className="w-3.5 h-3.5" />
                Sort by:
              </span>
              <select
                value={overallSort}
                onChange={e => setOverallSort(e.target.value as any)}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-card border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
              >
                <option value="highest">Highest Rated ★</option>
                <option value="lowest">Lowest Rated</option>
                <option value="reviews">Most Reviews</option>
              </select>
            </div>
          </div>

          {/* Faculty Scorecards Grid */}
          {filteredScorecards.length === 0 ? (
            <div className="text-center py-20 bg-card/50 border border-border/60 rounded-2xl p-8">
              <AlertCircle className="w-10 h-10 text-muted-foreground/60 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-foreground">No faculty evaluations found</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {overallSearch ? 'No faculty matches your search filter.' : 'No faculty reviews have been submitted yet.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredScorecards.map(scorecard => (
                <div
                  key={scorecard.initials}
                  className="bg-card border border-border/80 rounded-2xl p-5 shadow-sm hover:border-primary/40 hover:shadow-md transition-all space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3.5">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 border-b border-border/40 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-base">
                          {scorecard.initials}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-foreground">
                            {scorecard.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                            <span>Initials: <strong className="text-foreground">{scorecard.initials}</strong></span>
                            <span>•</span>
                            <span>{scorecard.totalReviews} total evaluation{scorecard.totalReviews > 1 ? 's' : ''}</span>
                            {scorecard.pendingCount > 0 && (
                              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                                {scorecard.pendingCount} pending
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Overall Rating Badge */}
                      <div className="text-right shrink-0">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-500 font-extrabold text-base">
                          <Star className="w-4 h-4 fill-amber-500" />
                          <span>{scorecard.overallRating}</span>
                          <span className="text-xs text-muted-foreground font-normal">/5.0</span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {scorecard.wouldTakeAgainPct}% Would retake
                        </div>
                      </div>
                    </div>

                    {/* 5-Dimension Mini Progress Bars */}
                    <div className="space-y-2 pt-1">
                      {[
                        { label: 'Teaching Clarity', val: scorecard.avgClarity },
                        { label: 'Grading Fairness', val: scorecard.avgFairness },
                        { label: 'Exam Alignment', val: scorecard.avgAlignment },
                        { label: 'Office Hours Access', val: scorecard.avgOfficeHours },
                        { label: 'Attendance Strictness', val: scorecard.avgStrictness },
                      ].map(dim => (
                        <div key={dim.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground font-medium">{dim.label}</span>
                            <span className="font-bold text-foreground">{dim.val} / 5.0</span>
                          </div>
                          <div className="h-2 w-full bg-muted/60 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                dim.val >= 4.0
                                  ? 'bg-emerald-500'
                                  : dim.val >= 3.0
                                  ? 'bg-amber-500'
                                  : 'bg-rose-500'
                              }`}
                              style={{ width: `${(dim.val / 5) * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Course Breakdown Pills */}
                    <div className="pt-2 border-t border-border/40">
                      <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-2">
                        Evaluated Courses:
                      </span>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(scorecard.courses).map(([code, info]) => (
                          <span
                            key={code}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-card border border-border text-xs font-semibold text-foreground shadow-xs"
                          >
                            <BookOpen className="w-3 h-3 text-primary" />
                            <span>{code}</span>
                            <span className="text-amber-500 font-bold">{info.avgRating} ★</span>
                            <span className="text-[10px] text-muted-foreground">({info.count})</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Top Traits Badges */}
                    {scorecard.topTraits.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {scorecard.topTraits.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Drilldown Trigger Button */}
                  <div className="pt-3 border-t border-border/40 mt-3">
                    <button
                      onClick={() => setSelectedDrilldownInitials(scorecard.initials)}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border/80 transition-all cursor-pointer shadow-xs"
                    >
                      <span>View Individual Reviews & Full Scorecard</span>
                      <ChevronRight className="w-3.5 h-3.5 text-primary" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* FACULTY DETAILED DRILLDOWN MODAL                                          */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {drilldownFaculty && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-3xl p-6 sm:p-7 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto space-y-6 my-6"
            >
              {/* Modal Header */}
              <div className="flex items-start justify-between gap-4 border-b border-border/60 pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center font-extrabold text-primary text-xl">
                    {drilldownFaculty.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h2 className="text-xl font-bold text-foreground">{drilldownFaculty.name}</h2>
                      <span className="px-2.5 py-0.5 rounded-md text-xs font-bold bg-primary/10 text-primary border border-primary/20">
                        {drilldownFaculty.initials}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Comprehensive faculty evaluation scorecard & individual student submissions
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setSelectedDrilldownInitials(null)}
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Overall Summary Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 bg-muted/30 border border-border/60 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Overall Rating
                  </span>
                  <div className="text-3xl font-black text-amber-500 flex items-center justify-center gap-1.5">
                    <Star className="w-6 h-6 fill-amber-500" />
                    <span>{drilldownFaculty.overallRating}</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">out of 5.0</span>
                </div>

                <div className="p-4 bg-muted/30 border border-border/60 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Would Retake Ratio
                  </span>
                  <div className="text-3xl font-black text-emerald-500 flex items-center justify-center gap-1.5">
                    <ThumbsUp className="w-6 h-6" />
                    <span>{drilldownFaculty.wouldTakeAgainPct}%</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">student recommendation</span>
                </div>

                <div className="p-4 bg-muted/30 border border-border/60 rounded-2xl text-center">
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block mb-1">
                    Total Evaluations
                  </span>
                  <div className="text-3xl font-black text-foreground">
                    {drilldownFaculty.totalReviews}
                  </div>
                  <span className="text-xs text-muted-foreground mt-1 block">
                    {drilldownFaculty.approvedCount} approved • {drilldownFaculty.pendingCount} pending
                  </span>
                </div>
              </div>

              {/* 5-Dimensions Detailed Breakdown */}
              <div className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Multi-Dimensional Academic Scorecard:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: 'Teaching Clarity', val: drilldownFaculty.avgClarity },
                    { label: 'Grading Fairness', val: drilldownFaculty.avgFairness },
                    { label: 'Exam Alignment', val: drilldownFaculty.avgAlignment },
                    { label: 'Office Hours Accessibility', val: drilldownFaculty.avgOfficeHours },
                    { label: 'Attendance Strictness', val: drilldownFaculty.avgStrictness },
                  ].map(dim => (
                    <div key={dim.label} className="p-2.5 bg-card border border-border/60 rounded-xl space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground font-medium">{dim.label}</span>
                        <span className="font-bold text-foreground">{dim.val} / 5.0</span>
                      </div>
                      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${(dim.val / 5) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Course by course breakdown */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Course-Specific Performance:
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {Object.entries(drilldownFaculty.courses).map(([code, info]) => (
                    <div key={code} className="p-3 bg-card border border-border/70 rounded-xl">
                      <div className="font-bold text-sm text-foreground flex items-center justify-between">
                        <span>{code}</span>
                        <span className="text-amber-500 font-bold text-xs">{info.avgRating} ★</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5 block">
                        {info.count} evaluation{info.count > 1 ? 's' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Reviews Section inside Drilldown */}
              <div className="space-y-3 pt-3 border-t border-border/60">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <User className="w-4 h-4 text-primary" />
                    Individual Student Submissions ({drilldownFaculty.reviews.length})
                  </h4>

                  {/* Filter inside drilldown */}
                  <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg text-xs">
                    {(['all', 'pending', 'approved', 'rejected'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setDrilldownStatusFilter(f)}
                        className={`px-2 py-0.5 rounded capitalize font-medium cursor-pointer ${
                          drilldownStatusFilter === f
                            ? 'bg-card text-foreground shadow-xs'
                            : 'text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {drilldownFaculty.reviews
                    .filter(r => drilldownStatusFilter === 'all' ? true : r.status === drilldownStatusFilter)
                    .map(r => {
                      const rAvg = (
                        (Number(r.clarity_rating) +
                          Number(r.grading_fairness) +
                          Number(r.exam_alignment) +
                          Number(r.office_hours_accessibility) +
                          Number(r.attendance_strictness)) /
                        5
                      ).toFixed(1);

                      return (
                        <div key={r.id} className="p-4 bg-muted/20 border border-border/60 rounded-2xl space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-xs text-foreground">
                                  {r.profiles?.full_name || 'Anonymous Student'}
                                </span>
                                <span className="text-[11px] text-muted-foreground font-mono">
                                  ({r.profiles?.student_id || 'ID Hidden'})
                                </span>
                                <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-muted text-muted-foreground border border-border">
                                  {r.course_code}
                                </span>
                                <span className="text-[11px] text-muted-foreground">
                                  {r.semester}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                <Star className="w-3 h-3 fill-amber-500" />
                                {rAvg}
                              </span>

                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                  r.status === 'approved'
                                    ? 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                                    : r.status === 'rejected'
                                    ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30'
                                    : 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>
                          </div>

                          {/* Dimensions */}
                          <div className="grid grid-cols-5 gap-1.5 text-center text-[11px] bg-card p-2 rounded-xl border border-border/50">
                            <div>
                              <span className="text-[9px] text-muted-foreground uppercase block">Clarity</span>
                              <span className="font-bold text-foreground">{r.clarity_rating}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground uppercase block">Fairness</span>
                              <span className="font-bold text-foreground">{r.grading_fairness}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground uppercase block">Exam</span>
                              <span className="font-bold text-foreground">{r.exam_alignment}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground uppercase block">Office</span>
                              <span className="font-bold text-foreground">{r.office_hours_accessibility}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-muted-foreground uppercase block">Strict</span>
                              <span className="font-bold text-foreground">{r.attendance_strictness}</span>
                            </div>
                          </div>

                          {/* Notes */}
                          {r.exam_prep_tips && (
                            <p className="text-xs text-muted-foreground italic">
                              <strong className="text-amber-500 not-italic">Exam tip:</strong> "{r.exam_prep_tips}"
                            </p>
                          )}
                          {r.review_note && (
                            <p className="text-xs text-foreground italic">
                              <strong className="text-primary not-italic">Review:</strong> "{r.review_note}"
                            </p>
                          )}

                          {/* Moderation inline buttons */}
                          <div className="flex items-center justify-end gap-2 pt-1">
                            {r.status !== 'approved' && (
                              <button
                                onClick={() => handleApprove(r)}
                                disabled={submittingId === r.id}
                                className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                                Approve
                              </button>
                            )}
                            {r.status !== 'rejected' && (
                              <button
                                onClick={() => openRejectModal(r)}
                                disabled={submittingId === r.id}
                                className="inline-flex items-center gap-1 px-3 py-1 text-[11px] font-semibold rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/30 cursor-pointer"
                              >
                                <X className="w-3 h-3" />
                                Reject...
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rejection Modal with Custom Note and Notification dispatch */}
      <AnimatePresence>
        {rejectModalReview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-lg w-full space-y-4"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2 text-rose-500 font-bold text-base">
                  <X className="w-5 h-5" />
                  <h3>Reject Faculty Evaluation</h3>
                </div>
                <button
                  onClick={() => setRejectModalReview(null)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Rejecting evaluation for <strong>{rejectModalReview.faculty_initials}</strong> ({rejectModalReview.course_code}). Please provide a polite and clear reason so the student can fix their submission.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Reason / Feedback for Student: <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={rejectionNote}
                  onChange={e => setRejectionNote(e.target.value)}
                  placeholder="e.g. Please avoid abusive phrasing and focus on constructive course-specific feedback..."
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-muted/40 border border-border focus:outline-none focus:ring-2 focus:ring-rose-500/40 text-foreground placeholder:text-muted-foreground"
                />
                <p className="text-[11px] text-muted-foreground">
                  Upon submitting, the student will receive an instant push notification containing this note, and can edit & resubmit their evaluation in the app.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectModalReview(null)}
                  disabled={isRejecting}
                  className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={isRejecting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all cursor-pointer"
                >
                  {isRejecting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Rejecting & Notifying...
                    </>
                  ) : (
                    <>
                      <X className="w-3.5 h-3.5" />
                      Confirm Rejection & Send Alert
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
