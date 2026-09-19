import re, glob, os

src_dir = '/Users/anatolichastik/Documents/WEB-QUINTE-SMART-HOMES/WEB-QUINTE-SMART-HOMES/src'

old_accent = '#9E8B7D'
new_accent = '#969193'

old_dark = '#89786C'
new_dark = '#807c7e'

file_patterns = ['**/*.css', '**/*.html', '**/*.njk', '**/*.md']
files = []
for root, dirs, filenames in os.walk(src_dir):
    for filename in filenames:
        if filename.endswith(('.css', '.html', '.njk', '.md')):
            files.append(os.path.join(root, filename))

count_accent = 0
count_dark = 0

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content.replace('#9E8B7D', new_accent).replace('#9e8b7d', new_accent)
    new_content = new_content.replace('#89786C', new_dark).replace('#89786c', new_dark)

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

print("Color replacement complete.")
