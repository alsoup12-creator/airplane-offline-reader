"""Create a source-compatible upload directory. Official CLI owns ZIP packaging."""
from pathlib import Path
import hashlib
import json

root = Path(__file__).resolve().parents[1]
source = root / 'xhs-offline-skill'
target = root / 'redskill-release' / 'xhs-offline-skill'
if target.exists():
    raise SystemExit('Target already exists; refusing to overwrite')
inputs = sorted(p for p in source.rglob('*') if p.is_file())
before = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
target.mkdir(parents=True)
for file in inputs:
    if file.is_symlink():
        raise SystemExit('Symlink in source; stopped')
    relative = file.relative_to(source)
    if relative.name == 'types.d.ts':
        relative = relative.with_name('types.md')
        content = '# 数据接口定义\n\n```typescript\n' + file.read_text(encoding='utf-8') + '\n```\n'
    else:
        if relative.suffix == '.mjs':
            relative = relative.with_suffix('.js')
        content = file.read_text(encoding='utf-8').replace('.mjs', '.js').replace('types.d.ts', 'types.md')
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(content, encoding='utf-8', newline='\n')
(target / 'package.json').write_text(json.dumps({
    'name': 'xhs-offline-skill', 'version': '0.1.0', 'private': True,
    'type': 'module', 'engines': {'node': '>=22.12'},
    'description': 'Personal offline image-and-text feed skill; local runtime only.'
}, indent=2), encoding='utf-8')
after = {str(p.relative_to(source)): hashlib.sha256(p.read_bytes()).hexdigest() for p in inputs}
assert before == after, 'Original source changed'
files = list(target.rglob('*'))
assert all(p.suffix in {'.md', '.js', '.html', '.css', '.json'} for p in files if p.is_file())
assert not any('.mjs' in p.read_text(encoding='utf-8') or 'types.d.ts' in p.read_text(encoding='utf-8') for p in files if p.is_file())
print(json.dumps({'directory': str(target), 'fileCount': sum(p.is_file() for p in files), 'sourceUnchanged': True, 'zipCreated': False}, ensure_ascii=False))
