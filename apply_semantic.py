import os
import re

files = [
    'src/components/Layout.tsx',
    'src/pages/Dashboard.tsx',
    'src/components/dashboard/StatsGrid.tsx',
    'src/components/dashboard/SystemDiagnostics.tsx',
    'src/pages/UsersList.tsx',
    'src/pages/UserDetails.tsx',
    'src/pages/CalendarEditor.tsx'
]

replacements = {
    r'bg-slate-50 dark:bg-slate-900\b': 'bg-background',
    r'bg-slate-50 dark:bg-slate-950\b': 'bg-background',
    r'bg-white dark:bg-slate-950\b': 'bg-card',
    r'bg-white dark:bg-slate-800\b': 'bg-card',
    r'bg-white dark:bg-slate-900\b': 'bg-card',
    r'border-slate-200 dark:border-white/5\b': 'border-border',
    r'border-slate-100 dark:border-white/5\b': 'border-border',
    r'border-slate-50 dark:border-white/5\b': 'border-border',
    r'border-white/5\b': 'border-border',
    r'text-slate-900 dark:text-white\b': 'text-foreground',
    r'text-slate-800 dark:text-white\b': 'text-foreground',
    r'text-slate-700 dark:text-slate-300\b': 'text-foreground',
    r'text-slate-400 dark:text-slate-500\b': 'text-muted-foreground',
    r'text-slate-500 dark:text-slate-400\b': 'text-muted-foreground',
    r'text-slate-600 dark:text-slate-400\b': 'text-muted-foreground',
    r'bg-slate-100 dark:bg-white/5\b': 'bg-muted',
    r'bg-slate-50 dark:bg-white/5\b': 'bg-muted',
    r'bg-slate-50/50 dark:bg-white/5\b': 'bg-muted/50',
    r'bg-slate-100 dark:bg-slate-900\b': 'bg-muted',
    r'bg-slate-100 dark:bg-slate-800\b': 'bg-muted',
    r'hover:bg-slate-100 dark:hover:bg-white/5\b': 'hover:bg-accent hover:text-accent-foreground',
    r'hover:bg-slate-50 dark:hover:bg-white/5\b': 'hover:bg-accent hover:text-accent-foreground',
    r'hover:bg-slate-100 dark:hover:bg-white/10\b': 'hover:bg-accent hover:text-accent-foreground',
    r'bg-black/20 backdrop-blur-md\b': 'bg-card border-t border-border',
    r'bg-slate-900/80\b': 'bg-background/80',
    r'bg-white/80\b': 'bg-background/80',
    r'bg-[#F8FAFC] dark:bg-\[\#0F172A\]\b': 'bg-background',
    r'bg-slate-50/50 dark:bg-slate-900/30\b': 'bg-muted/30',
    r'bg-slate-50/30 dark:bg-black/10\b': 'bg-muted/10',
    r'dark:border-slate-800\b': 'border-border',
    r'border-slate-200/60\b': 'border-border',
    r'border-slate-200/50\b': 'border-border',
    r'bg-[#F8FAFC]\b': 'bg-background',
    r'dark:bg-[#0F172A]\b': 'bg-background'
}

for filepath in files:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    for old, new in replacements.items():
        content = re.sub(old, new, content)
    
    # Strip some additional ugly hardcoded text values
    content = content.replace('text-[10px]', 'text-xs')
    content = content.replace('text-[9px]', 'text-xs')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Semantic UI applied")
