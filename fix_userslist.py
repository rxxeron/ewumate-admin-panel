import os

filepath = 'src/pages/UsersList.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the malformed query.or(...)
content = content.replace("query = query.or(\x0Cull_name.ilike.% + searchTerm + %,student_id.ilike.% + searchTerm + %);", "query = query.or(ull_name.ilike.%%,student_id.ilike.%%);")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
