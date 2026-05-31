#!/usr/bin/env python3
"""
Migrate API routes: add 'await' to all DB method calls (.all, .get, .run, .exec).
"""
import re, os, glob

def migrate(content):
    lines = content.split('\n')
    result = []

    for line in lines:
        stripped = line.lstrip()
        # Skip comments, imports, type lines
        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('import'):
            result.append(line)
            continue

        # Pattern 1: line already has await → skip
        if 'await ' in line:
            result.append(line)
            continue

        modified = line

        # Pattern 2: assignment with db method
        # const x = db.prepare(...).all() or .get() or .run()
        # const x = db.prepare(\n  ...\n).run(  ← multi-line handled by ").run(" pattern below
        modified = re.sub(
            r'((?:const|let|var)\s+\w+\s*=\s*)(db\.prepare)',
            r'\1await \2',
            modified
        )

        # Pattern 3: result.lastInsertRowid access after chained .run → already handled above

        # Pattern 4: bare db.prepare().xxx() call (no assignment)
        # db.prepare('...').run(...) at start of statement
        modified = re.sub(
            r'^(\s*)(db\.prepare)',
            lambda m: m.group(1) + 'await ' + m.group(2),
            modified
        )

        # Pattern 5: ).run( or ).get( or ).all( at start of line (multi-line prepare)
        # e.g.:    ).run(a, b, c);
        if re.match(r'^\s*\)\s*\.\s*(all|get|run)\s*\(', modified):
            modified = re.sub(
                r'^(\s*)(\)\s*\.\s*(?:all|get|run)\s*\()',
                r'\1await \2',
                modified
            )

        # Pattern 6: db.exec(
        modified = re.sub(
            r'^(\s*)(db\.exec\s*\()',
            lambda m: m.group(1) + 'await ' + m.group(2),
            modified
        )

        result.append(modified)

    return '\n'.join(result)


base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
routes = glob.glob(os.path.join(base, 'app', 'api', '**', 'route.js'), recursive=True)

changed = 0
for path in sorted(routes):
    with open(path) as f:
        original = f.read()
    if 'getDb' not in original:
        continue
    migrated = migrate(original)
    if migrated != original:
        with open(path, 'w') as f:
            f.write(migrated)
        print(f'  ✅ {path.replace(base, "")}')
        changed += 1

print(f'\nDone — {changed} files updated')
