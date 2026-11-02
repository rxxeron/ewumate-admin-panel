import os
import re

filepath = 'src/components/Layout.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

pattern = r'const getLinkClass = \(path: string\) => \{.*?return cn\(.*?\);.*?\}\;'
new_func = """const getLinkClass = (path: string) => {
    const isActive = location.pathname === path;
    return cn(
      "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group relative",
      isActive 
      ? 'bg-muted text-foreground font-medium shadow-sm border border-border' 
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
    );
  };"""

content = re.sub(pattern, new_func, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
