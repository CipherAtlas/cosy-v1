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
            if item['asset'] not in ('custom-path', 'path-straight', 'path-curved', 'fence-line') or not isinstance(path, dict) or type(path.get('width')) not in (int, float) or not .3 <= path['width'] <= (3 if item['asset'] == 'fence-line' else 20):
                raise ValueError('Invalid path width.')
            points = path.get('points')
            if not isinstance(points, list) or not 2 <= len(points) <= 100 or any(not isinstance(p, list) or len(p) != 2 or any(type(n) not in (int, float) or not math.isfinite(n) or abs(n) > 2000 for n in p) for p in points):
                raise ValueError('Invalid path points.')
            if all(math.hypot(p[0] - points[0][0], p[1] - points[0][1]) < .01 for p in points):
                raise ValueError('A path needs two distinct points.')
            if item['asset'] == 'fence-line' and sum(math.hypot(b[0] - a[0], b[1] - a[1]) for a, b in zip(points, points[1:])) > 300:
                raise ValueError('A fence line can be up to 300 metres long.')
        elif item['asset'] in ('custom-path', 'path-straight', 'path-curved', 'fence-line'):
            raise ValueError('A path needs control points.')
    routes = doc.get('routes')
    if routes is not None:
        if not isinstance(routes, dict) or any(name not in ('pip', 'maple', 'moss', 'luma', 'wren') for name in routes):
            raise ValueError('Invalid resident routes.')
        for route in routes.values():
            if not isinstance(route, dict) or not isinstance(route.get('points'), list) or not 2 <= len(route['points']) <= 100:
                raise ValueError('Resident routes need 2–100 points.')
            if any(not isinstance(point, list) or len(point) != 2 or any(type(n) not in (int, float) or not math.isfinite(n) or abs(n) > 2000 for n in point) for point in route['points']):
                raise ValueError('Invalid resident route point.')
            pauses = route.get('pauses')
            if pauses is not None and (not isinstance(pauses, list) or len(pauses) != len(route['points']) or any(type(n) not in (int, float) or not math.isfinite(n) or n < 0 or n > 30 for n in pauses)):
                raise ValueError('Invalid resident route pauses.')
    return doc


def digest(data):
    return hashlib.sha256(data).hexdigest()


def playable_asset(item):
    return item['asset'] in ('custom-path', 'path-straight', 'path-curved', 'fence-line', 'grass-tuft', 'grass-patch', 'grass-wide', 'planting-clearance', 'walkable-region', 'oak-bench', 'puppy-corgi', 'puppy-shiba', 'puppy-beagle', 'puppy-samoyed', 'cottage-1', 'cottage-2', 'cottage-3', 'cottage-4', 'cottage-7', 'cottage-8', 'cottage-9', 'tower') or bool(re.fullmatch(r'tree-\d+', item['asset']))


def check_playable_changes(previous, next_doc):
    before = {item['id']: item for item in previous['objects']}
    after = {item['id']: item for item in next_doc['objects']}
    for object_id in before.keys() | after.keys():
        old, new = before.get(object_id), after.get(object_id)
        if old and old['asset'] in ('cottage-1', 'cottage-2', 'cottage-3', 'cottage-4', 'cottage-7', 'cottage-8', 'cottage-9', 'tower') and (new is None or new['asset'] != old['asset']):
            raise ValueError('Playable cottages and the village spire cannot be removed or replaced.')
        if (old and not playable_asset(old)) or (new and not playable_asset(new)):
            if old is None or new is None or any(old.get(key) != new.get(key) for key in ('asset', 'position', 'rotation', 'scale', 'visible', 'path')):
                raise ValueError('This layout changes an object the playable map does not yet control. Apply paths, grass, erased planting, trees, walkable areas, oak meadow benches, puppies, and resident routes; keep other object placements in a saved working copy.')
    for item in next_doc['objects']:
        if not playable_asset(item): continue
        if item['asset'] in ('cottage-1', 'cottage-2', 'cottage-3', 'cottage-4', 'cottage-7', 'cottage-8', 'cottage-9', 'tower') and (not item['visible'] or item['scale'] != [1, 1, 1]):
            raise ValueError('Playable cottages and the village spire support position and facing; keep them visible at 1× scale.')
        if item['asset'] in ('cottage-1', 'cottage-2', 'cottage-3', 'cottage-4', 'cottage-7', 'cottage-8', 'cottage-9', 'tower') and item['id'] != item['asset']:
            raise ValueError('Only the existing cottages and village spire can be repositioned in the playable layout.')
        if not re.fullmatch(r'tree-\d+', item['asset']) and (abs(item['rotation'][0]) > .001 or abs(item['rotation'][2]) > .001):
            raise ValueError('Playable world objects use upright rotation. Set X and Z rotation to 0 before applying.')
        if item['asset'] in ('custom-path', 'path-straight', 'path-curved', 'fence-line') and (abs(item['scale'][0] - item['scale'][2]) > .001 or abs(item['scale'][1] - 1) > .001):
            raise ValueError('Playable paths use even horizontal scaling and 1× vertical scale. Use the path length and width controls to shape them.')


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


def make_handler(output, port, layouts, published=None):
    published = published or ROOT / 'public/village/world-layout.json'
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
            if route == '/api/playable':
                try:
                    data = published.read_bytes()
                    self.reply({'layout': validate(json.loads(data)), 'revision': digest(data)})
                except FileNotFoundError: self.reply({'error': 'Playable layout not found.'}, 404)
                except (OSError, ValueError): self.reply({'error': 'The playable layout is unreadable; the file is preserved.'}, 422)
                return
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
            if route == '/api/apply':
                try:
                    size = int(self.headers.get('Content-Length', '0'))
                    if not 0 < size <= MAX_BYTES: raise ValueError('Layout is empty or exceeds 2 MB.')
                    doc = validate(json.loads(self.rfile.read(size)))
                    data = (json.dumps(doc, ensure_ascii=False, indent=2, allow_nan=False) + '\n').encode()
                except (ValueError, TypeError) as exc:
                    self.reply({'error': str(exc)}, 400); return
                try:
                    with SAVE_LOCK:
                        previous = published.read_bytes() if published.exists() else None
                        expected = self.headers.get('If-Match', '')
                        if expected != (digest(previous) if previous else 'new'):
                            self.reply({'error': 'The playable layout changed. Reload the studio before applying again.'}, 409); return
                        if previous:
                            try: check_playable_changes(validate(json.loads(previous)), doc)
                            except ValueError as exc:
                                self.reply({'error': str(exc)}, 422); return
                        if previous:
                            history = layouts / '.history'; history.mkdir(exist_ok=True)
                            (history / f'playable-{time.time_ns()}.json').write_bytes(previous)
                        with tempfile.NamedTemporaryFile(dir=published.parent, prefix='.applying-', delete=False) as stream:
                            stream.write(data); stream.flush(); os.fsync(stream.fileno()); temporary = stream.name
                        os.replace(temporary, published)
                    self.reply({'revision': digest(data), 'objects': len(doc['objects'])})
                except OSError:
                    self.reply({'error': 'Could not apply the playable layout. Your working copy is unchanged.'}, 500)
                return
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
    parser.add_argument('--playable-file', type=Path, default=ROOT / 'public/village/world-layout.json')
    args = parser.parse_args()
    args.layouts_dir.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='cosy-layout-studio-') as folder:
        output = Path(folder)
        print('Preparing the local village studio…', flush=True); compile_studio(output)
        server = ThreadingHTTPServer(('127.0.0.1', args.port), make_handler(output, args.port, args.layouts_dir, args.playable_file))
        print(f'Cosy Layout Studio: http://127.0.0.1:{args.port}\nLayouts: {args.layouts_dir}\nCtrl+C stops the studio. Restart after source edits.', flush=True)
        try: server.serve_forever()
        except KeyboardInterrupt: pass
        finally: server.server_close()

if __name__ == '__main__': main()
