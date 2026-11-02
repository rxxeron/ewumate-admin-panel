import os

# Fix UserDetails.tsx
with open('src/pages/UserDetails.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("const confirmText = DELETE ;", "const confirmText = `DELETE ${user.full_name || user.student_id}`;")
if "import { ConfirmModal }" not in content:
    content = content.replace("import { useState, useEffect } from 'react';", "import { useState, useEffect } from 'react';\nimport { ConfirmModal } from '../components/ConfirmModal';")

with open('src/pages/UserDetails.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix CalendarEditor.tsx
with open('src/pages/CalendarEditor.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

if "import * as z from 'zod';" not in content:
    content = "import { useForm } from 'react-hook-form';\nimport { zodResolver } from '@hookform/resolvers/zod';\nimport * as z from 'zod';\n" + content

with open('src/pages/CalendarEditor.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Fix UsersList.tsx
with open('src/pages/UsersList.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace("../../types", "../types")

with open('src/pages/UsersList.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
