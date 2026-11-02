import os
import re

def fix_ui(filepath):
    if not os.path.exists(filepath):
        return
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Layout specific
    if 'Layout.tsx' in filepath:
        content = content.replace('bg-[#1E1B4B] text-white', 'bg-white dark:bg-slate-950 text-slate-900 dark:text-white border-r border-slate-200 dark:border-white/5')
        content = content.replace('text-white/60', 'text-slate-500 dark:text-slate-400')
        content = content.replace('text-white', 'text-slate-900 dark:text-white')
        content = content.replace('bg-white/10 text-white', 'bg-slate-100 dark:bg-white/10 text-primary dark:text-white')
        content = content.replace('bg-blue-400', 'bg-primary')
        content = content.replace('bg-amber-400', 'bg-primary')
        content = content.replace('hover:bg-white/5', 'hover:bg-slate-100 dark:hover:bg-white/5')
        content = content.replace('bg-black/20 backdrop-blur-md', 'bg-slate-50 dark:bg-slate-900/50')
        # Fix nav links text colors specifically if they are hardcoded to text-white/60
        content = content.replace('hover:text-white', 'hover:text-slate-900 dark:hover:text-white')

    # Global Typography Fixes
    content = content.replace('font-black', 'font-semibold')
    content = content.replace('tracking-widest', 'tracking-wider')
    content = content.replace('rounded-[2rem]', 'rounded-2xl')
    content = content.replace('rounded-[1.5rem]', 'rounded-xl')
    
    # Fix harsh borders and shadows if any
    content = content.replace('shadow-2xl', 'shadow-sm')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

files = [
    'src/components/Layout.tsx',
    'src/pages/Dashboard.tsx',
    'src/components/dashboard/StatsGrid.tsx',
    'src/components/dashboard/SystemDiagnostics.tsx',
    'src/pages/UsersList.tsx',
    'src/pages/UserDetails.tsx',
    'src/pages/CalendarEditor.tsx'
]

for f in files:
    fix_ui(f)
print("UI normalized")
