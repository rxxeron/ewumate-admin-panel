import os
import glob
import re

files = glob.glob('src/pages/*.tsx') + glob.glob('src/components/**/*.tsx', recursive=True)

for filepath in files:
    if not os.path.exists(filepath):
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Convert rounded-xl to rounded-md for inputs (more standard)
    # Convert bg-muted to bg-background for standard inputs
    content = re.sub(r'className="([^"]*)border-border([^"]*)bg-muted([^"]*)p-4', r'className="\1border-input\2bg-background\3px-4 py-2.5 focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm', content)
    
    # Target textarea specifically
    content = content.replace('className="w-full border-border rounded-xl bg-muted p-4 text-sm text-foreground"', 'className="w-full border-input rounded-md bg-background px-4 py-3 text-sm text-foreground focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm border"')
    
    # Target all other inputs if they have w-full border-border
    content = content.replace('w-full border-border rounded-xl bg-muted', 'w-full border border-input rounded-md bg-background focus:ring-2 focus:ring-ring focus:border-transparent shadow-sm')
    
    # Sidebar active button fix
    content = content.replace('border border-white/20', 'shadow-sm border border-border')

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)

print("Inputs polished")
