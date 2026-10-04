"""Local persistence boundary checks; uses only temporary test layouts."""
import importlib.util
import json
from pathlib import Path
import tempfile
import threading
import unittest
from http.server import ThreadingHTTPServer
from urllib.request import Request, urlopen
from urllib.error import HTTPError

STUDIO = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('studio_server', STUDIO / 'server.py')
server_module = importlib.util.module_from_spec(spec); spec.loader.exec_module(server_module)

class StudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='cosy-studio-test-')
        folder = Path(self.tmp.name); (folder / 'layouts').mkdir(); (folder / 'index.html').write_text('local studio')
        self.layouts = folder / 'layouts'
        self.original = (STUDIO / 'presets/current-village.json').read_bytes()
        self.published = folder / 'world-layout.json'; self.published.write_bytes(self.original)
        self.server = ThreadingHTTPServer(('127.0.0.1', 0), lambda *args, **kwargs: None)
        self.port = self.server.server_port
        self.server.RequestHandlerClass = server_module.make_handler(folder, self.port, self.layouts, self.published)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True); self.thread.start()
        self.doc = json.loads((STUDIO / 'presets/current-village.json').read_text())

    def tearDown(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join(); self.tmp.cleanup()
        self.assertEqual((STUDIO / 'presets/current-village.json').read_bytes(), self.original)

    def request(self, route, doc=None, revision='new', origin=True, host=None):
        headers = {}
        if origin: headers['Origin'] = f'http://127.0.0.1:{self.port}'
        if host: headers['Host'] = host
        if doc is not None: headers.update({'Content-Type':'application/json','If-Match':revision})
        request = Request(f'http://127.0.0.1:{self.port}{route}', headers=headers, data=json.dumps(doc).encode() if doc is not None else None)
        try:
            with urlopen(request) as response: return response.status, json.loads(response.read())
        except HTTPError as response:
            with response: return response.code, response.read().decode()

    def test_save_roundtrip_conflict_and_history(self):
        code, saved = self.request('/api/layouts/my-village', self.doc); self.assertEqual(code, 200)
        code, opened = self.request('/api/layouts/my-village'); self.assertEqual(code, 200); self.assertEqual(opened['layout'], self.doc)
        self.assertEqual(opened['revision'], saved['revision'])
        self.doc['name'] = 'Edited copy'
        code, _ = self.request('/api/layouts/my-village', self.doc, revision='stale'); self.assertEqual(code, 409)
        code, changed = self.request('/api/layouts/my-village', self.doc, revision=saved['revision']); self.assertEqual(code, 200)
        self.assertNotEqual(changed['revision'], saved['revision'])
        history = list((self.layouts / '.history').glob('*.json')); self.assertEqual(len(history), 1)
        self.assertEqual(json.loads(history[0].read_text())['name'], 'Current village')
        self.assertEqual(list(self.layouts.glob('.saving-*')), [])

    def test_original_presets_and_arbitrary_paths_are_protected(self):
        for route in ['/api/presets/current-village','/api/initialize-preset','/api/layouts/../current-village','/api/layouts/invalid.name']:
            self.assertEqual(self.request(route, self.doc)[0],403)
        self.assertEqual(self.request('/api/layouts/does-not-exist')[0],404)

    def test_animal_art_apply(self):
        manifest = json.loads((STUDIO.parents[1] / 'docs/village/animals-v2-manifest.json').read_text())
        self.doc['sceneVersion'] = 1
        for index, animal in enumerate(manifest['animals']):
            self.doc['objects'].append({'id': f'animal-review-{index}', 'asset': f"animal-{animal['id']}",
                'name': animal['id'], 'position': [150 + index * 4, 3, 130], 'rotation': [10, 35, 5],
                'scale': [1.2, 1.1, 1.3], 'visible': True, 'locked': False})
        _, playable = self.request('/api/playable')
        code, result = self.request('/api/apply', self.doc, revision=playable['revision'])
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(self.published.read_text()), self.doc)
        accepted = self.published.read_bytes()
        self.doc['objects'][-1]['asset'] = 'animal-unknown'
        self.assertEqual(self.request('/api/apply', self.doc, revision=result['revision'])[0], 422)
        self.assertEqual(self.published.read_bytes(), accepted)

    def test_same_origin_host_and_body_validation(self):
        self.assertEqual(self.request('/api/layouts/test', self.doc, origin=False)[0],403)
        self.assertEqual(self.request('/api/health', host='attacker.example')[0],403)
        self.doc['objects'][0]['position'][0] = None
        self.assertEqual(self.request('/api/layouts/test', self.doc)[0],400)
        self.assertFalse((self.layouts / 'test.json').exists())

    def test_duplicate_ids_and_bounded_values(self):
        self.doc['objects'].append(self.doc['objects'][0])
        with self.assertRaises(ValueError): server_module.validate(self.doc)
        self.doc['objects'].pop()
        for value in [float('nan'),float('inf'),-1,0,101]:
            self.doc['objects'][0]['scale'][0] = value
            with self.assertRaises(ValueError): server_module.validate(self.doc)

    def test_corrupt_files_are_preserved_and_reported(self):
        corrupt = self.layouts / 'broken.json'; corrupt.write_text('{bad-json')
        self.assertEqual(self.request('/api/layouts/broken')[0],422)
        code, library = self.request('/api/library'); self.assertEqual(code,200)
        self.assertIn('error',library['layouts'][0]); self.assertEqual(corrupt.read_text(),'{bad-json')

    def test_paths_need_valid_shape(self):
        item = self.doc['objects'][0]; item['asset'] = 'custom-path'
        with self.assertRaises(ValueError): server_module.validate(self.doc)
        item['path'] = {'width':2,'points':[[0,0],[5,5]]}; server_module.validate(self.doc)
        item['path']['points'] = [[0,0]]
        with self.assertRaises(ValueError): server_module.validate(self.doc)

    def test_river_roundtrip_apply_and_invalid_data(self):
        revision = self.request('/api/playable')[1]['revision']
        river = {'id': 'drawn-river', 'asset': 'custom-river', 'name': 'River', 'position': [40, 0, 30], 'rotation': [0, 30, 0], 'scale': [1, 1, 1], 'visible': True, 'locked': False, 'path': {'width': 6, 'points': [[0, 0], [4, -6], [0, -12]]}}
        self.doc['objects'].append(river)
        self.assertEqual(self.request('/api/layouts/river', self.doc)[0], 200)
        self.assertEqual(self.request('/api/layouts/river')[1]['layout'], self.doc)
        self.assertEqual(self.request('/api/apply', self.doc, revision=revision)[0], 200)
        revision = self.request('/api/playable')[1]['revision']
        for scene_version in (None, 1):
            if scene_version: self.doc['sceneVersion'] = scene_version
            for rotation, scale in [([30, 0, 0], [1, 1, 1]), ([0, 0, 0], [2, 1, 1]), ([0, 0, 0], [1, 2, 1])]:
                river['rotation'], river['scale'] = rotation, scale
                self.assertEqual(self.request('/api/apply', self.doc, revision=revision)[0], 422)
        for width in (0, 21, float('nan')):
            river['path']['width'] = width
            with self.assertRaises(ValueError): server_module.validate(self.doc)

    def test_terrain_and_horses_roundtrip_apply_and_invalid_data(self):
        revision = self.request('/api/playable')[1]['revision']
        delta = 5 - server_module.base_terrain_height(70, 30)
        self.doc['terrain'] = {'version': 1, 'cellSize': 2, 'samples': [[35, 15, delta]]}
        self.doc['objects'].append({'id': 'riding-horse', 'asset': 'horse-bay', 'name': 'Bay horse', 'position': [70, 5, 30], 'rotation': [0, 90, 0], 'scale': [1, 1, 1], 'visible': True, 'locked': False})
        self.assertEqual(self.request('/api/layouts/elevated', self.doc)[0], 200)
        self.assertEqual(self.request('/api/layouts/elevated')[1]['layout'], self.doc)
        self.assertEqual(self.request('/api/apply', self.doc, revision=revision)[0], 200)
        self.assertEqual(json.loads(self.published.read_text()), self.doc)
        for samples in [[[35, 15, float('nan')]], [[0, 0, 10]], [[161, 15, 1]], [[35.5, 15, 1]], [[35, 15, 60]], [[35, 15, delta], [35, 15, delta]]]:
            self.doc['terrain']['samples'] = samples
            with self.assertRaises(ValueError): server_module.validate(self.doc)
        self.doc['terrain']['samples'] = [[35, 15, delta]]
        self.doc['objects'][-1]['scale'] = [3, 3, 3]
        with self.assertRaises(ValueError): server_module.validate(self.doc)

    def test_fence_and_cottage_edits_apply_with_bounds(self):
        revision = self.request('/api/playable')[1]['revision']
        cottage = next(item for item in self.doc['objects'] if item['asset'] == 'cottage-3')
        cottage['position'][0] += 2
        fence = {'id':'test-fence','asset':'fence-line','name':'Oak fence line','position':[0,0,0],
                 'rotation':[0,0,0],'scale':[1,1,1],'visible':True,'locked':False,
                 'path':{'points':[[0,0],[0,6]],'width':1.4}}
        self.doc['objects'].append(fence)
        self.assertEqual(self.request('/api/apply', self.doc, revision=revision)[0], 200)
        fence['path']['width'] = 3.1
        with self.assertRaises(ValueError): server_module.validate(self.doc)
        fence['path']['width'] = 1.4
        fence['path']['points'][1] = [301, 0]
        with self.assertRaises(ValueError): server_module.validate(self.doc)
        fence['path']['points'][1] = [0, 6]
        cottage['scale'][0] = 2
        with self.assertRaises(ValueError): server_module.check_playable_changes(self.doc, self.doc)
        cottage['scale'][0] = 1
        extra = cottage.copy(); extra['id'] = 'extra-cottage'; self.doc['objects'].append(extra)
        with self.assertRaises(ValueError): server_module.check_playable_changes(self.doc, self.doc)

    def test_apply_updates_only_playable_file_with_revision_and_backup(self):
        code, playable = self.request('/api/playable'); self.assertEqual(code, 200)
        self.assertEqual(playable['layout'], self.doc)
        self.doc['name'] = 'Expanded village'
        self.assertEqual(self.request('/api/apply', self.doc, revision='stale')[0], 409)
        self.assertEqual(self.published.read_bytes(), self.original)
        self.assertEqual(self.request('/api/apply', self.doc, revision=playable['revision'], origin=False)[0], 403)
        code, applied = self.request('/api/apply', self.doc, revision=playable['revision'])
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(self.published.read_text())['name'], 'Expanded village')
        self.assertEqual(len(list((self.layouts / '.history').glob('playable-*.json'))), 1)
        self.assertEqual(self.request('/api/apply', self.doc, revision=playable['revision'])[0], 409)

    def test_apply_rejects_static_object_edits_and_accepts_authored_world_layers(self):
        revision = self.request('/api/playable')[1]['revision']
        self.doc['objects'][0]['position'][0] += 2
        self.assertEqual(self.request('/api/apply', self.doc, revision=revision)[0], 422)
        self.assertEqual(self.published.read_bytes(), self.original)
        self.doc = json.loads(self.original)
        self.doc['objects'].append({'id':'new-meadow-bench','asset':'oak-bench','name':'Meadow bench',
            'position':[58,0,28],'rotation':[0,90,0],'scale':[1,1,1],'visible':True,'locked':False})
        self.doc['objects'].append({'id':'clear-road-edge','asset':'planting-clearance','name':'Erased planting area',
            'position':[2,0,12],'rotation':[0,0,0],'scale':[1.5,1,1.5],'visible':True,'locked':False})
        self.doc['routes'] = {'pip': {'points': [[0,16],[58,28]], 'pauses':[0,3]}}
        code, _ = self.request('/api/apply', self.doc, revision=revision)
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(self.published.read_text())['routes']['pip']['pauses'], [0,3])
        self.assertTrue(any(item['id'] == 'clear-road-edge' for item in json.loads(self.published.read_text())['objects']))

    def test_complete_scene_changes_apply_and_unknown_assets_refuse(self):
        revision = self.request('/api/playable')[1]['revision']
        self.doc['sceneVersion'] = 1; self.doc['openWorld'] = True
        self.doc['terrain'] = {'version': 1, 'cellSize': 2, 'base': 'flat', 'samples': []}
        self.doc['objects'] = [item for item in self.doc['objects'] if item['asset'] not in ('forest', 'cottage-3') and not item['asset'].startswith('mountain-')]
        self.doc['objects'].append({'id':'distant-tree','asset':'forest-1','name':'Distant tree','position':[120,0,90],
            'rotation':[0,90,0],'scale':[1,1,1],'visible':True,'locked':False})
        self.doc['objects'].append({'id':'ground-extension','asset':'land-tile-40','name':'Meadow ground','position':[100,0,90],
            'rotation':[0,0,0],'scale':[1,1,1],'visible':True,'locked':False})
        code, applied = self.request('/api/apply', self.doc, revision=revision)
        self.assertEqual(code, 200); self.assertEqual(json.loads(self.published.read_text()), self.doc)
        self.assertEqual(len(list((self.layouts / '.history').glob('playable-*.json'))), 1)
        self.doc['objects'][-1]['asset'] = 'unregistered-hidden-prop'
        self.assertEqual(self.request('/api/apply', self.doc, revision=applied['revision'])[0], 422)

if __name__ == '__main__': unittest.main()
