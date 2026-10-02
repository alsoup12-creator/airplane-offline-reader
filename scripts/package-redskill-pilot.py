"""Package only the runtime source, never cached user content or credentials."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import hashlib
import json

root = Path(__file__).resolve().parents[1]
source = root / 'xhs-offline-skill'
output = root / 'redskill-pilot'
output.mkdir(exist_ok=True)
archive = output / 'xhs-offline-runtime-0.1.0.zip'
files = []
for file in sorted(source.rglob('*')):
    if not file.is_file():
        continue
    if file.is_symlink():
        raise RuntimeError('Runtime must not contain symlinks')
    relative = file.relative_to(source)
    if relative.parts[0] not in {'adapters', 'offline', 'scripts', 'viewer', 'references', 'SKILL.md'}:
        continue
    if file.suffix not in {'.mjs', '.js', '.html', '.css', '.md', '.ts'}:
        continue
    files.append((file, f'xhs-offline-skill/{relative.as_posix()}'))
with ZipFile(archive, 'w', ZIP_DEFLATED) as bundle:
    for file, name in files:
        bundle.write(file, name)
manifest = {'version': '0.1.0', 'archive': archive.name,
            'sha256': hashlib.sha256(archive.read_bytes()).hexdigest(),
            'sizeBytes': archive.stat().st_size, 'files': [name for _, name in files],
            'platformUploadVerified': False, 'containsUserContent': False}
(output / 'package-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'archive': str(archive), 'files': len(files), 'sizeBytes': manifest['sizeBytes']}, ensure_ascii=False))
