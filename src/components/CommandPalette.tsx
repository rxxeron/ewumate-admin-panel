import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, User, BookOpen, Settings, Globe, Bell, ShieldCheck, 
  Terminal, CalendarDays, TrendingUp, Library, Clock, 
  Heart, Mail, FileUp, Smartphone, GraduationCap, X, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

interface PaletteItem {
  id: string;
  name: string;
  category: 'Platform' | 'Academic Core' | 'Community & Moderation' | 'DevOps & Automation' | 'Students';
  path: string;
  icon: any;
  hint?: string;
}

const ADMIN_PAGES: PaletteItem[] = [
  // Platform
  { id: 'overview', name: 'Overview Dashboard', category: 'Platform', path: '/', icon: Globe },
  { id: 'analytics', name: 'Advanced Analytics', category: 'Platform', path: '/analytics', icon: TrendingUp },

  // Academic Core
  { id: 'active-semester', name: 'Active Semester & Advising', category: 'Academic Core', path: '/active-semester', icon: CalendarDays },
  { id: 'calendar-editor', name: 'Academic Calendar', category: 'Academic Core', path: '/calendar-editor', icon: CalendarDays },
  { id: 'courses', name: 'Course Catalog & Sections', category: 'Academic Core', path: '/courses', icon: BookOpen },
  { id: 'academic-data', name: 'Global Master Data', category: 'Academic Core', path: '/academic-data', icon: Terminal },
  { id: 'faculty', name: 'Faculty Directory', category: 'Academic Core', path: '/faculty', icon: GraduationCap },
  { id: 'office-hours', name: 'Office Hours Moderation', category: 'Academic Core', path: '/office-hours', icon: Clock },
  { id: 'faculty-assignments', name: 'Faculty Proofs Moderation', category: 'Academic Core', path: '/faculty-assignments', icon: ShieldCheck },
  { id: 'faculty-reviews', name: 'Student Reviews Moderation', category: 'Academic Core', path: '/faculty-reviews', icon: GraduationCap },

  // Community & Moderation
  { id: 'users', name: 'Student Directory & Profiles', category: 'Community & Moderation', path: '/users', icon: User },
  { id: 'study-vault', name: 'Study Vault Moderation', category: 'Community & Moderation', path: '/study-vault', icon: Library },
  { id: 'tutorials', name: 'Tutorials & Guides', category: 'Community & Moderation', path: '/tutorials', icon: BookOpen },
  { id: 'feedbacks', name: 'Feedback & Bug Reports Inbox', category: 'Community & Moderation', path: '/feedbacks', icon: Mail },
  { id: 'donations', name: 'Developer Support & Donations', category: 'Community & Moderation', path: '/donations', icon: Heart },

  // DevOps & Automation
  { id: 'scraper', name: 'Portal Automation Scraper', category: 'DevOps & Automation', path: '/scraper', icon: Globe },
  { id: 'notifications', name: 'Cloud Push Broadcaster', category: 'DevOps & Automation', path: '/notifications', icon: Bell },
  { id: 'local-notifications', name: 'Local Alarms & Logs', category: 'DevOps & Automation', path: '/local-notifications', icon: Smartphone },
  { id: 'parser', name: 'File Sync & Document Parser', category: 'DevOps & Automation', path: '/parser', icon: FileUp },
  { id: 'data-quality', name: 'Data Integrity & Anomaly Audits', category: 'DevOps & Automation', path: '/data-quality', icon: ShieldCheck },
  { id: 'settings', name: 'App Config & Ad Settings', category: 'DevOps & Automation', path: '/settings', icon: Settings },
];

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PaletteItem[]>(ADMIN_PAGES);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen((prev) => !prev);
    }
    if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, []);

  // Listen for open events triggered from Header
  useEffect(() => {
    const handleCustomOpen = () => setIsOpen(true);
    window.addEventListener('open-command-palette', handleCustomOpen);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('open-command-palette', handleCustomOpen);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSelectedIndex(0);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Search logic across static routes and live students
  useEffect(() => {
    if (!query.trim()) {
      setResults(ADMIN_PAGES);
      setIsSearchingStudents(false);
      return;
    }

    const cleanQuery = query.toLowerCase().trim();
    const filteredPages = ADMIN_PAGES.filter(
      (p) =>
        p.name.toLowerCase().includes(cleanQuery) ||
        p.category.toLowerCase().includes(cleanQuery) ||
        p.path.toLowerCase().includes(cleanQuery)
    );

    let isCancelled = false;

    if (cleanQuery.length >= 2) {
      setIsSearchingStudents(true);
      const sanitized = cleanQuery.replace(/[,()]/g, '');

      (async () => {
        try {
          const { data } = await supabase
            .from('profiles')
            .select('id, full_name, student_id, program_code')
            .or(`full_name.ilike.%${sanitized}%,student_id.ilike.%${sanitized}%`)
            .limit(5);

          if (isCancelled) return;
          setIsSearchingStudents(false);

          const studentItems: PaletteItem[] = (data || []).map((u) => ({
            id: `user-${u.id}`,
            name: u.full_name || 'Student',
            category: 'Students',
            path: `/users/${u.id}`,
            icon: User,
            hint: `${u.student_id} • ${u.program_code || 'General'}`,
          }));

          setResults([...filteredPages, ...studentItems]);
        } catch {
          if (!isCancelled) {
            setIsSearchingStudents(false);
            setResults(filteredPages);
          }
        }
      })();
    } else {
      setResults(filteredPages);
      setIsSearchingStudents(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [query]);

  const handleSelect = (item: PaletteItem) => {
    navigate(item.path);
    setIsOpen(false);
  };

  const handleNavigationKeys = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        handleSelect(results[selectedIndex]);
      }
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.15 }}
            className="relative w-full max-w-2xl bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh]"
          >
            {/* Search Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-border bg-background/50">
              <Search className="w-4 h-4 text-muted-foreground mr-3 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleNavigationKeys}
                placeholder="Search command, page, or student name/ID..."
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none font-medium"
              />
              {isSearchingStudents && (
                <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0 mr-2" />
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Results List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
              {results.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No matching admin commands or students found for <span className="font-semibold text-foreground">"{query}"</span>
                </div>
              ) : (
                results.map((item, index) => {
                  const Icon = item.icon;
                  const isSelected = index === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cn(
                        'w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm transition-colors text-left group',
                        isSelected ? 'bg-primary/10 text-primary font-semibold' : 'text-foreground hover:bg-muted/60'
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            'p-2 rounded-md shrink-0 transition-colors',
                            isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:text-foreground'
                          )}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="truncate">
                          <div className="truncate font-medium">{item.name}</div>
                          {item.hint && <div className="text-xs text-muted-foreground font-mono">{item.hint}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                          {item.category}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>Navigate <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">↑</kbd> <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">↓</kbd></span>
                <span>Select <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">↵</kbd></span>
                <span>Close <kbd className="px-1.5 py-0.5 bg-background border border-border rounded font-mono">esc</kbd></span>
              </div>
              <span className="font-medium text-foreground">EWUMate Mission Control</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
