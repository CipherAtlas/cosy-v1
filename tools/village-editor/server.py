"""Local layout studio. No third-party Python modules or public application routes."""
import argparse
import hashlib
import json
import math
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import threading
import time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[2]
STUDIO = ROOT / 'tools/village-editor'
SAVE_LOCK = threading.Lock()
ID = re.compile(r'^[a-zA-Z0-9_-]{1,100}$')
MAX_BYTES = 2_000_000


def validate(doc):
    if not isinstance(doc, dict) or doc.get('version') != 1 or doc.get('base') != 'cosy-village-2026-09-27':
        raise ValueError('Unsupported layout version or village.')
    if not isinstance(doc.get('name'), str) or not doc['name'].strip() or len(doc['name']) > 100:
        raise ValueError('Use a layout name of 1–100 characters.')
    objects = doc.get('objects')
    if not isinstance(objects, list) or len(objects) > 2000:
        raise ValueError('A layout can contain up to 2,000 objects.')
    ids = set()
    for item in objects:
        if not isinstance(item, dict) or not isinstance(item.get('id'), str) or not ID.fullmatch(item['id']) or item['id'] in ids:
            raise ValueError('Invalid or repeated object ID.')
        ids.add(item['id'])
        if not isinstance(item.get('asset'), str) or not ID.fullmatch(item['asset']) or not isinstance(item.get('name'), str) or len(item['name']) > 100:
            raise ValueError('Invalid object asset or name.')
        if type(item.get('visible')) is not bool or type(item.get('locked')) is not bool:
            raise ValueError('Invalid object visibility or lock.')
        for key, limit in [('position', 2000), ('rotation', 36000), ('scale', 100)]:
            values = item.get(key)
            if not isinstance(values, list) or len(values) != 3 or any(type(n) not in (int, float) or not math.isfinite(n) or abs(n) > limit or (key == 'scale' and n < .01) for n in values):
                raise ValueError(f'Invalid {key}.')
        path = item.get('path')
        if path is not None:
            if item['asset'] not in ('custom-path', 'path-straight', 'path-curved') or not isinstance(path, dict) or type(path.get('width')) not in (int, float) or not .3 <= path['width'] <= 20:
                raise ValueError('Invalid path width.')
            points = path.get('points')
            if not isinstance(points, list) or not 2 <= len(points) <= 100 or any(not isinstance(p, list) or len(p) != 2 or any(type(n) not in (int, float) or not math.isfinite(n) or abs(n) > 2000 for n in p) for p in points):
                raise ValueError('Invalid path points.')
            if all(math.hypot(p[0] - points[0][0], p[1] - points[0][1]) < .01 for p in points):
                raise ValueError('A path needs two distinct points.')
        elif item['asset'] in ('custom-path', 'path-straight', 'path-curved'):
            raise ValueError('A path needs control points.')
    return doc


def digest(data):
    return hashlib.sha256(data).hexdigest()


def compile_studio(output):
    config = {'compilerOptions': {'target': 'ES2022', 'module': 'ES2022', 'moduleResolution': 'bundler', 'strict': True,
        'outDir': str(output / 'modules'), 'rootDir': str(ROOT), 'baseUrl': str(ROOT), 'paths': {'@/*': ['./*']},
        'skipLibCheck': True, 'typeRoots': [str(ROOT / 'node_modules/@types')], 'types': ['node']},
        'files': [str(STUDIO / 'editor.ts')]}
    (output / 'tsconfig.json').write_text(json.dumps(config))
    subprocess.run([str(ROOT / 'node_modules/.bin/tsc'), '-p', str(output / 'tsconfig.json')], check=True)
    for file in (output / 'modules').rglob('*.js'):
        text = file.read_text().replace('"@/lib/basePath"', '"../../lib/basePath.js"')
        text = re.sub(r'(from\s+["\'])(\.[^"\']+)(["\'])', lambda m: m[1] + m[2] + ('' if m[2].endswith('.js') else '.js') + m[3], text)
        file.write_text(text.replace('process.env.NEXT_PUBLIC_BASE_PATH', '""'))
    for name in ['index.html', 'editor.css']:
        shutil.copy(STUDIO / name, output / name)
    (output / 'village').symlink_to(ROOT / 'public/village', target_is_directory=True)
    (output / 'three').symlink_to(ROOT / 'node_modules/three', target_is_directory=True)


def make_handler(output, port, layouts):
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(output), **kwargs)

        def trusted(self, write=False):
            if self.headers.get('Host') not in (f'127.0.0.1:{port}', f'localhost:{port}'):
                self.send_error(403, 'Local editor host required'); return False
            origin = self.headers.get('Origin')
            if (write or origin) and origin not in (f'http://127.0.0.1:{port}', f'http://localhost:{port}'):
                self.send_error(403, 'Same-origin editor request required'); return False
            return True

        def end_headers(self):
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Content-Type-Options', 'nosniff')
            self.send_header('X-Frame-Options', 'DENY')
            super().end_headers()

        def reply(self, value, status=200):
            data = json.dumps(value, ensure_ascii=False).encode()
            self.send_response(status); self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(data))); self.end_headers(); self.wfile.write(data)

        def do_GET(self):
            if not self.trusted(): return
            route = unquote(urlsplit(self.path).path)
            if route == '/api/health':
                self.reply({'service': 'cosy-layout-studio', 'localOnly': True, 'port': port}); return
            if route == '/api/library':
                result = {'presets': [], 'layouts': []}
                for kind, directory in [('presets', STUDIO / 'presets'), ('layouts', layouts)]:
                    for path in sorted(directory.glob('*.json')):
                        try:
                            data = path.read_bytes(); doc = validate(json.loads(data))
                            result[kind].append({'id': path.stem, 'name': doc['name'], 'revision': digest(data), 'objects': len(doc['objects'])})
                        except (OSError, ValueError):
                            result[kind].append({'id': path.stem, 'name': path.stem, 'error': 'File could not be read; the original is preserved.'})
                self.reply(result); return
            match = re.fullmatch(r'/api/(presets|layouts)/([a-zA-Z0-9_-]{1,100})', route)
            if match:
                directory = STUDIO / 'presets' if match[1] == 'presets' else layouts
                path = directory / (match[2] + '.json')
                try:
                    data = path.read_bytes(); self.reply({'layout': validate(json.loads(data)), 'revision': digest(data)})
                except FileNotFoundError: self.reply({'error': 'Layout not found.'}, 404)
                except (OSError, ValueError): self.reply({'error': 'The layout file is unreadable; it has been left intact.'}, 422)
                return
            # Serve only the compiled studio and its explicitly linked public art/modules.
            if route != '/' and not (route in ['/index.html', '/editor.css'] or route.startswith(('/modules/', '/village/', '/three/'))):
                self.send_error(404); return
            if '..' in route.split('/') or '\\' in route:
                self.send_error(403); return
            super().do_GET()

        def do_POST(self):
            if not self.trusted(write=True): return
            route = urlsplit(self.path).path
            match = re.fullmatch(r'/api/layouts/([a-zA-Z0-9_-]{1,100})', route)
            if not match:
                self.reply({'error': 'Presets are read-only.'}, 403); return
            try:
                size = int(self.headers.get('Content-Length', '0'))
                if not 0 < size <= MAX_BYTES: raise ValueError('Layout is empty or exceeds 2 MB.')
                payload = json.loads(self.rfile.read(size)); doc = validate(payload)
            except (ValueError, TypeError) as exc:
                self.reply({'error': str(exc)}, 400); return
            data = (json.dumps(doc, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()
            path = layouts / (match[1] + '.json')
            try:
                with SAVE_LOCK:
                    previous = path.read_bytes() if path.exists() else None
                    expected = self.headers.get('If-Match', '')
                    if expected != (digest(previous) if previous else 'new'):
                        self.reply({'error': 'This file changed in another tab. Save a copy to keep both versions.'}, 409); return
                    if previous:
                        history = layouts / '.history'; history.mkdir(exist_ok=True)
                        backup = history / f'{path.stem}-{time.time_ns()}.json'; backup.write_bytes(previous)
                    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.saving-', delete=False) as stream:
                        stream.write(data); stream.flush(); os.fsync(stream.fileno()); temporary = stream.name
                    os.replace(temporary, path)
                self.reply({'revision': digest(data), 'id': path.stem})
            except OSError:
                self.reply({'error': 'Could not write the layout. Your browser draft is still available; use Export JSON as a backup.'}, 500)

        def log_message(self, fmt, *args):
            if args and ('/api/' in str(args[0]) or str(args[1]) != '200'): super().log_message(fmt, *args)
    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=3040)
    parser.add_argument('--layouts-dir', type=Path, default=STUDIO / 'layouts')
    args = parser.parse_args()
    args.layouts_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cosy-layout-studio-') as folder:
        output = Path(folder)
        print('Preparing the local village studio…', flush=True); compile_studio(output)
        server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(output, args.port, args.layouts_dir))
        print(f'Cosy Layout Studio: http://127.0.0.1:{args.port}\nLayouts: {args.layouts_dir}\nCtrl+C stops the studio. Restart after source edits.', flush=True)
        try: server.serve_forever()
        except KeyboardInterrupt: pass
        finally: server.server_close()

if __name__ == '__main__': main()
