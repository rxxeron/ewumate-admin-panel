import { useState, useEffect, useCallback } from 'react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';
import { Search, User, Book, Settings, Globe, Bell, Shield, Terminal } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();

  const pages = [
    { name: 'Dashboard Overview', path: '/', icon: Globe },
    { name: 'Student Profiles', path: '/users', icon: User },
    { name: 'Course Catalog', path: '/courses', icon: Book },
    { name: 'Academic Data', path: '/academic-data', icon: Terminal },
    { name: 'Portal Scraper', path: '/scraper', icon: Globe },
    { name: 'Notifications', path: '/notifications', icon: Bell },
    { name: 'System Settings', path: '/settings', icon: Settings },
    { name: 'Data Integrity', path: '/data-quality', icon: Shield },
  ];

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setIsOpen(prev => !prev);
    }
    if (e.key === 'Escape') setIsOpen(false);
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (!query) {
      setResults(pages);
      return;
    }

    const searchData = async () => {
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name, student_id')
        .or(`full_name.ilike.%${query}%,student_id.ilike.%${query}%`)
        .limit(5);

      const filteredPages = pages.filter(p => 
        p.name.toLowerCase().includes(query.toLowerCase())
      );

      setResults([
        ...filteredPages,
        ...(users?.map(u => ({ 
          name: u.full_name, 
          path: `/users/${u.id}`, 
          icon: User, 
          sub: u.student_id 
        })) || [])
      ]);
    };

    const timer = setTimeout(searchData, 200);
    return () => clearTimeout(timer);
  }, [query]);

  const onSelect = (path: string) => {
    navigate(path);
    setIsOpen(false);
    setQuery('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-md" 
        onClick={() => setIsOpen(false)}
      />
      
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -20 }}
        className="relative w-full max-w-2xl bg-card rounded-3xl shadow-2xl border border-slate-200 dark:border-border overflow-hidden"
      >
        <div className="p-6 border-b border-border flex items-center gap-4">
          <Search className="w-6 h-6 text-muted-foreground" />
          <input
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-lg font-bold text-foreground placeholder:text-slate-300 dark:placeholder:text-slate-600"
            placeholder="Search command or student..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setSelectedIndex(s => (s + 1) % results.length);
              if (e.key === 'ArrowUp') setSelectedIndex(s => (s - 1 + results.length) % results.length);
              if (e.key === 'Enter') onSelect(results[selectedIndex].path);
            }}
          />
          <div className="px-2 py-1 bg-muted rounded-md text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">ESC</div>
        </div>

        <div className="max-h-[400px] overflow-y-auto p-2">
          {results.length > 0 ? (
            results.map((item, i) => (
              <button
                key={i}
                className={cn(
                  "w-full flex items-center gap-4 p-4 rounded-lg transition-all text-left",
                  selectedIndex === i ? "bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20" : "hover:bg-accent hover:text-accent-foreground border-transparent",
                  "border"
                )}
                onMouseEnter={() => setSelectedIndex(i)}
                onClick={() => onSelect(item.path)}
              >
                <div className={cn(
                  "p-2 rounded-xl bg-card shadow-sm",
                  selectedIndex === i ? "text-primary dark:text-primary" : "text-muted-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-semibold text-foreground text-sm">{item.name}</div>
                  {item.sub && <div className="text-[10px] font-bold text-primary dark:text-primary uppercase tracking-wider">{item.sub}</div>}
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center text-slate-400 font-bold text-sm">
              No results found for "{query}"
            </div>
          )}
        </div>

        <div className="p-4 bg-background/50 border-t border-border flex items-center justify-between">
           <div className="flex gap-4 items-center">
             <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card border border-slate-200 dark:border-border rounded shadow-sm text-[10px] font-semibold text-foreground">↑↓</kbd>
                <span className="text-[10px] font-bold text-muted-foreground">Navigate</span>
             </div>
             <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-card border border-slate-200 dark:border-border rounded shadow-sm text-[10px] font-semibold text-foreground">Enter</kbd>
                <span className="text-[10px] font-bold text-muted-foreground">Select</span>
             </div>
           </div>
           <div className="text-[10px] font-semibold text-primary dark:text-primary uppercase tracking-wider">EWUmate Terminal</div>
        </div>
      </motion.div>
    </div>
  );
}

